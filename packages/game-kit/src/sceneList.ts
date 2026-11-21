export interface SceneListDef<S> {
  playScene: S;
  scenes?: S[];
}

/** Pure scene ordering: [Preload, Title, play, ...extras, GameOver]. */
export function sceneList<S>(def: SceneListDef<S>, builtins: { preload: S; title: S; gameOver: S }): S[] {
  return [builtins.preload, builtins.title, def.playScene, ...(def.scenes ?? []), builtins.gameOver];
}
