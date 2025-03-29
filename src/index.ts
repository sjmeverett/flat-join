type ExtractType<T, Type> = Extract<T, { type: Type }>;

type ChildTypes<
  T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
> = Extract<Exclude<T[TypeKey], PrimaryType>, string>;

type ChildFieldsMap<
  T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
> = Record<ChildTypes<T, TypeKey, PrimaryType>, string>;

type ChildFields<
  T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
  Map extends ChildFieldsMap<T, TypeKey, PrimaryType>,
> = {
  [K in keyof Map as Map[K]]: ExtractType<T, K>[];
};

export type JoinedType<
  T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
  Map extends ChildFieldsMap<T, TypeKey, PrimaryType>,
> = ExtractType<T, PrimaryType> & ChildFields<T, TypeKey, PrimaryType, Map>;

function getChildFields<
  T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
  Map extends ChildFieldsMap<T, TypeKey, PrimaryType>,
>(map: Map): ChildFields<T, TypeKey, PrimaryType, Map> {
  const result = {} as ChildFields<T, TypeKey, PrimaryType, Map>;

  for (const k in map) {
    type ResultType = typeof result;
    const key = map[k] as keyof ResultType;
    result[key] = [] as ResultType[typeof key];
  }

  return result;
}

export interface JoinOptions<IdKey, IdKeyType, TypeKey> {
  idKey: IdKey;
  typeKey: TypeKey;
  predicate: (childId: IdKeyType, parentId: IdKeyType) => boolean;
  throwOnOrphanedData?: boolean;
}

export class OrphanedDataError extends Error {
  constructor(
    public readonly data: unknown,
    public readonly index: number,
  ) {
    super(
      `Orphaned data was detected at index ${index} and options.throwOnOrphans is set to true`,
    );
  }
}

export function flatJoin<
  T extends Record<string, unknown>,
  IdKey extends keyof T,
  TypeKey extends keyof T,
  PrimaryType extends T[TypeKey],
  Map extends ChildFieldsMap<T, TypeKey, PrimaryType>,
>(
  docs: T[],
  primaryType: PrimaryType,
  childFieldNames: Map,
  options: JoinOptions<IdKey, T[IdKey], TypeKey>,
): JoinedType<T, TypeKey, PrimaryType, Map>[] {
  type Joined = JoinedType<T, TypeKey, PrimaryType, Map>;

  const result: Joined[] = [];
  let currentPrimary: Joined | undefined = undefined;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    if (doc[options.typeKey] === primaryType) {
      currentPrimary = { ...doc, ...getChildFields(childFieldNames) } as Joined;
      result.push(currentPrimary);
    } else if (
      currentPrimary &&
      options.predicate(doc[options.idKey], currentPrimary[options.idKey])
    ) {
      const type = doc[options.typeKey] as keyof Map;
      const key = childFieldNames[type] as keyof typeof currentPrimary;

      type Child = ExtractType<T, typeof type>;
      const field = currentPrimary[key] as Child[];

      field.push(doc as Child);
    } else if (options.throwOnOrphanedData) {
      throw new OrphanedDataError(doc, i);
    }
  }

  return result;
}

export function createJoinOn<
  IdKey extends string,
  IdKeyType,
  TypeKey extends string,
>(options: JoinOptions<IdKey, IdKeyType, TypeKey>) {
  return <
    T extends { [K in IdKey]: IdKeyType } & {
      [K in TypeKey | string]: unknown;
    },
    PrimaryType extends T[TypeKey],
    Map extends ChildFieldsMap<T, TypeKey, PrimaryType>,
  >(
    docs: T[],
    primaryType: PrimaryType,
    childFieldNames: Map,
  ) => {
    return flatJoin(docs, primaryType, childFieldNames, options);
  };
}
