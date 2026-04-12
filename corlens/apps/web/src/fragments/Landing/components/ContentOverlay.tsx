import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type {
  LabelContent,
  LabelPlacement,
  LabelStyle,
} from "../scene/sceneTypes";

type ContentOverlayProps = {
  item: LabelContent;
  viewIndex: number;
  isExiting?: boolean;
};

const defaultPlacement: LabelPlacement = {
  layer: "front",
  x: 12,
  y: 18,
};

const defaultStyle: LabelStyle = {
  variant: "glass",
  showTitle: true,
  showSubtitle: true,
  showBody: true,
};

export function ContentOverlay({
  item,
  viewIndex,
  isExiting = false,
}: ContentOverlayProps) {
  const placement = item.labelPlacement ?? defaultPlacement;
  const style = { ...defaultStyle, ...item.labelStyle };
  const variant = style.variant ?? "glass";
  const showTitle = style.showTitle ?? true;
  const showSubtitle = style.showSubtitle ?? true;
  const showBody = style.showBody ?? true;
  const hasBody = showBody && Boolean(item.body || item.bodyHtml);
  const showScrollCue = style.showScrollCue ?? false;
  const hasMedia = Boolean(item.media);
  const actionTo = item.action?.to;
  const isInteractive = Boolean(actionTo);
  const capsuleBackground = style.capsuleColor ?? style.background;
  const subtitleColor = style.subtitleColor ?? style.tagColor;
  const bodyColor = style.bodyColor ?? style.textColor;
  const capsuleWidth = style.capsuleWidth ?? style.maxWidth;
  const entrance = item.labelMotion?.entrance ?? "none";
  const exit = item.labelMotion?.exit ?? "none";
  const useGradientStrokeTitle = Boolean(
    style.titleStrokeGradientFrom && style.titleStrokeGradientTo,
  );
  const gradientId = `landing-stroke-grad-${viewIndex}-${item.content
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
  const motionClass = isExiting
    ? exit === "none"
      ? ""
      : `landing-label-card--exit-${exit}`
    : entrance === "none"
      ? ""
      : `landing-label-card--enter-${entrance}`;

  const layerStyle = {
    "--landing-label-x": `${placement.x}%`,
    "--landing-label-y": `${placement.y}%`,
  } as CSSProperties;

  const cardStyle = {
    "--landing-label-bg": capsuleBackground,
    "--landing-label-border": style.borderColor,
    "--landing-label-text": bodyColor,
    "--landing-button-bg": capsuleBackground,
    "--landing-button-border": style.borderColor,
    "--landing-button-shadow": style.shadowColor,
    "--landing-label-title": style.titleColor,
    "--landing-label-title-gradient": style.titleGradient,
    "--landing-label-title-opacity": toCssUnitless(style.titleOpacity),
    "--landing-label-title-shadow": style.titleTextShadow,
    "--landing-label-title-fill": style.titleGradient
      ? "transparent"
      : "currentColor",
    "--landing-label-title-stroke-color": style.titleStrokeColor,
    "--landing-label-title-stroke-width": toCssSize(style.titleStrokeWidth),
    "--landing-label-title-weight": toCssUnitless(style.titleWeight),
    "--landing-label-title-width": toCssSize(style.titleWidth),
    "--landing-label-title-height": toCssUnitless(style.titleHeight),
    "--landing-label-title-scale-y": toCssUnitless(style.titleScaleY),
    "--landing-label-title-spacing": toCssSize(style.titleSpacing),
    "--landing-label-tag": subtitleColor,
    "--landing-label-shadow": style.shadowColor,
    "--landing-label-width": toCssSize(capsuleWidth),
    "--landing-label-height": toCssSize(style.capsuleHeight),
    "--landing-label-align": style.textAlign,
    "--landing-label-padding": toCssSize(style.capsulePadding),
    "--landing-label-title-size": toCssSize(style.titleSize),
    "--landing-label-subtitle-size": toCssSize(style.subtitleSize),
    "--landing-label-body-size": toCssSize(style.bodySize),
    "--landing-label-body-width": toCssSize(style.bodyWidth),
    "--landing-label-media-aspect": toCssSize(style.mediaAspectRatio),
  } as CSSProperties;

  const cardClasses = [
    "landing-label-card",
    `landing-label-card--${variant}`,
    hasBody ? "landing-label-card--body" : "",
    showScrollCue ? "landing-label-card--scroll-cue" : "",
    hasMedia ? "landing-label-card--media" : "",
    isInteractive ? "landing-label-card--button" : "",
    motionClass,
  ]
    .filter(Boolean)
    .join(" ");

  const cardContent = (
    <>
      {showTitle ? (
        useGradientStrokeTitle ? (
          <h1 className="landing-label-title landing-label-title--stroke-gradient">
            <svg
              className="landing-label-title-svg"
              viewBox={`0 0 ${Math.max(320, item.content.length * 140)} 130`}
              preserveAspectRatio="xMinYMid meet"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor={style.titleStrokeGradientFrom} />
                  <stop offset="100%" stopColor={style.titleStrokeGradientTo} />
                </linearGradient>
              </defs>
              <text
                className="landing-label-title-svg-text"
                x="0"
                y="120"
                fill="transparent"
                stroke={`url(#${gradientId})`}
                strokeWidth={toSvgStrokeWidth(style.titleStrokeWidth)}
                style={{
                  fontFamily: "inherit",
                  fontWeight: toCssUnitless(style.titleWeight),
                  letterSpacing: toCssSize(style.titleSpacing),
                }}
              >
                {item.content}
              </text>
            </svg>
          </h1>
        ) : (
          <h1 className="landing-label-title">{item.content}</h1>
        )
      ) : null}
      {showSubtitle ? (
        <p className="landing-label-tag">
          {item.subtitle ?? `View ${String(viewIndex + 1).padStart(2, "0")}`}
        </p>
      ) : null}
      {showBody ? (
        item.bodyHtml ? (
          <p
            className="landing-label-hint"
            dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
          />
        ) : (
          <p className="landing-label-hint">{item.body}</p>
        )
      ) : null}
      {item.media?.type === "video" ? (
        <div className="landing-label-media">
          <video
            className="landing-label-video"
            src={item.media.src}
            poster={item.media.poster}
            controls={item.media.controls ?? true}
            autoPlay={item.media.autoPlay ?? false}
            loop={item.media.loop ?? true}
            muted={item.media.muted ?? true}
            playsInline={item.media.playsInline ?? true}
            preload="metadata"
          />
        </div>
      ) : null}
    </>
  );

  return (
    <div
      className={`landing-label-layer landing-label-layer--${placement.layer}`}
      style={layerStyle}
      aria-hidden={!isInteractive && !hasMedia}
    >
      {actionTo ? (
        <Link
          to={actionTo}
          aria-label={item.action?.ariaLabel ?? item.content}
          className={cardClasses}
          style={cardStyle}
        >
          {cardContent}
        </Link>
      ) : (
        <div className={cardClasses} style={cardStyle}>
          {cardContent}
        </div>
      )}
    </div>
  );
}

function toCssSize(value?: number | string) {
  if (typeof value === "number") {
    return `${value}px`;
  }

  return value;
}

function toCssUnitless(value?: number | string) {
  if (typeof value === "number") {
    return String(value);
  }

  return value;
}

function toSvgStrokeWidth(value?: number | string) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
