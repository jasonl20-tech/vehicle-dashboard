/**
 * Zusätzliche Lexical-Knoten für das CMS: eingebettete Medien (R2-Key + URL),
 * horizontale Trennlinie — Contentful-ähnlicher Fluss.
 */
import type { EditorConfig, LexicalEditor, LexicalNode, NodeKey } from "lexical";
import {
  $applyNodeReplacement,
  DecoratorNode,
  SerializedLexicalNode,
  Spread,
} from "lexical";
import type { JSX } from "react";
import CmsLexicalImageBlock from "./CmsLexicalImageBlock";

export type SerializedCmsImageNode = Spread<
  { src: string; altText: string; assetKey: string },
  SerializedLexicalNode
>;

export class CmsImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;
  __assetKey: string;

  static getType(): string {
    return "cms-image";
  }

  static clone(node: CmsImageNode): CmsImageNode {
    return new CmsImageNode(
      node.__src,
      node.__altText,
      node.__assetKey,
      node.__key,
    );
  }

  constructor(src: string, altText: string, assetKey: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
    this.__assetKey = assetKey;
  }

  exportJSON(): SerializedCmsImageNode {
    return {
      altText: this.__altText,
      assetKey: this.__assetKey,
      src: this.__src,
      type: "cms-image",
      version: 1,
    };
  }

  static importJSON(serialized: SerializedCmsImageNode): CmsImageNode {
    return $createCmsImageNode(
      serialized.src,
      serialized.altText,
      serialized.assetKey,
    );
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return (
      <CmsLexicalImageBlock
        src={this.__src}
        altText={this.__altText}
        assetKey={this.__assetKey}
      />
    );
  }

  isInline(): boolean {
    return false;
  }

  getAssetKey(): string {
    return this.getLatest().__assetKey;
  }
}

export function $createCmsImageNode(
  src: string,
  altText: string,
  assetKey: string,
): CmsImageNode {
  return $applyNodeReplacement(new CmsImageNode(src, altText, assetKey));
}

export function $isCmsImageNode(
  node: LexicalNode | null | undefined,
): node is CmsImageNode {
  return node instanceof CmsImageNode;
}

export type SerializedCmsHrNode = SerializedLexicalNode;

export class CmsHrNode extends DecoratorNode<JSX.Element> {
  static getType(): string {
    return "cms-hr";
  }

  static clone(n: CmsHrNode): CmsHrNode {
    return new CmsHrNode(n.__key);
  }

  constructor(key?: NodeKey) {
    super(key);
  }

  exportJSON(): SerializedCmsHrNode {
    return { type: "cms-hr", version: 1 };
  }

  static importJSON(_serialized: SerializedCmsHrNode): CmsHrNode {
    return $createCmsHrNode();
  }

  createDOM(): HTMLElement {
    return document.createElement("span");
  }

  updateDOM(): false {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): JSX.Element {
    return (
      <hr className="my-4 w-full border-0 border-t-2 border-[#e8eaed]" />
    );
  }

  isInline(): boolean {
    return false;
  }
}

export function $createCmsHrNode(): CmsHrNode {
  return $applyNodeReplacement(new CmsHrNode());
}

export function $isCmsHrNode(
  node: LexicalNode | null | undefined,
): node is CmsHrNode {
  return node instanceof CmsHrNode;
}
