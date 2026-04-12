declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  import type { Group, Loader, LoadingManager } from "three";

  export interface GLTF {
    scene: Group;
  }

  export class GLTFLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(
      url: string,
      onLoad: (gltf: GLTF) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void,
    ): void;
  }
}
