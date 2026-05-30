// Design Ref: §3.2 / §3 app_meta — key/value 메타 (data_version, install_date 등).
// Export 시 app_meta 전체 dump 필요 → getAll.

export interface AppMetaRepo {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  /** 전체 key/value (Export dump). */
  getAll(): Promise<Record<string, string | null>>;
}
