'use client';
import {
  type BlockAnnotationComponent,
  type CustomLine,
  type InlineAnnotationComponent,
  InnerLine,
} from 'codehike/code';
import { createContext, useContext, useState } from 'react';

const HoverContext = createContext<{
  hoveredNames: string[];
  addHoveredName: (_: string) => void;
  removeHoveredName: (_: string) => void;
}>({
  hoveredNames: [],
  addHoveredName: () => {},
  removeHoveredName: () => {},
});

export function HoverProvider({ children }: { children: React.ReactNode }) {
  const [hoveredNames, setHoveredNames] = useState<string[]>([]);

  const addHoveredName = (name: string) => {
    setHoveredNames((prev) => [...prev, name]);
  };

  const removeHoveredName = (name: string) => {
    setHoveredNames((prev) => prev.filter((n) => n !== name));
  };

  return (
    <HoverContext.Provider value={{ hoveredNames, addHoveredName, removeHoveredName }}>
      {children}
    </HoverContext.Provider>
  );
}

export function Hoverable({
  name,
  children,
  className,
  style,
}: {
  name: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { addHoveredName, removeHoveredName, hoveredNames } = useContext(HoverContext);
  const isHovered = hoveredNames.length > 0 && hoveredNames[hoveredNames.length - 1] === name;
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Visual hover highlight only, not interactive
    <span
      className={className}
      onMouseEnter={() => addHoveredName(name)}
      onMouseLeave={() => removeHoveredName(name)}
      data-hovered={isHovered}
      style={style}
    >
      {children}
    </span>
  );
}

export const HoverBlock: BlockAnnotationComponent = ({ annotation, children }) => {
  const { hoveredNames } = useContext(HoverContext);
  const name = annotation?.query;
  const isHovered = name && hoveredNames[hoveredNames.length - 1] === name;
  const style =
    isHovered && !annotation.data?.inline
      ? {
          ['--dk-line-bg' as string]: `rgb(from ${color} r g b / 0.13)`,
          ['--dk-line-border' as string]: color,
        }
      : undefined;

  return <div style={style}>{children}</div>;
};

const color = 'var(--ch-5)';

export const HoverLine: CustomLine = ({ annotation, ...props }) => {
  const { hoveredNames } = useContext(HoverContext);
  const prevOpacity = props.style?.opacity;
  const anyHovered = hoveredNames.length > 0;
  const name = annotation?.query;
  const isHovered = name && hoveredNames[hoveredNames.length - 1] === name;
  const opacity = isHovered
    ? 1
    : prevOpacity
      ? prevOpacity // dont dim if it's highlighted by another annotation
      : anyHovered
        ? 0.5 // other hovered but not this one
        : 1; // none hovered

  return (
    <InnerLine
      merge={props}
      style={{
        opacity,
        transition: 'opacity 0.3s ease',
      }}
    />
  );
};

export const HoverInline: InlineAnnotationComponent = ({ annotation, children }) => {
  const { hoveredNames } = useContext(HoverContext);
  const isHovered = hoveredNames[hoveredNames.length - 1] === annotation.query;
  return (
    <span
      className="rounded px-0.5 py-0 -mx-0.5"
      style={{
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
        boxShadow: isHovered ? `0 0 0 1px rgb(from ${color} r g b / 0.5)` : undefined,
        backgroundColor: isHovered ? `rgb(from ${color} r g b / 0.13)` : undefined,
      }}
    >
      {children}
    </span>
  );
};
