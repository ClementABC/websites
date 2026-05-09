declare module "*.css" {}

declare module "virtual:hatch-space-entry" {
  import type { ComponentType } from "react";

  const RenderSpace: ComponentType;
  export default RenderSpace;
}
