import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

const DEFAULT_COLOR = '#737480';
const DEFAULT_STROKE = 1.75;

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

function iconProps({ size = 18, color = DEFAULT_COLOR, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function StudyBookIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M4.5 5.4c2.7 0 4.6.7 6 2.1v11c-1.4-1.2-3.3-1.8-6-1.8V5.4Z" />
      <Path d="M19.5 5.4c-2.7 0-4.6.7-6 2.1v11c1.4-1.2 3.3-1.8 6-1.8V5.4Z" />
      <Line x1="12" y1="7.6" x2="12" y2="18.7" />
    </Svg>
  );
}

export function StudyQuizIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Rect x="6" y="4.6" width="12" height="14.8" rx="2.2" />
      <Path d="M10 9.2h4" />
      <Path d="M10 12h3" />
      <Circle cx="14.8" cy="15.4" r=".45" fill={props.color ?? DEFAULT_COLOR} stroke="none" />
    </Svg>
  );
}

export function StudyCalendarIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Rect x="4.5" y="6" width="15" height="13" rx="2.2" />
      <Path d="M8.2 4.2v3" />
      <Path d="M15.8 4.2v3" />
      <Path d="M4.8 9.5h14.4" />
      <Path d="M8 13h.1" />
      <Path d="M12 13h.1" />
      <Path d="M16 13h.1" />
      <Path d="M8 16h.1" />
      <Path d="M12 16h.1" />
    </Svg>
  );
}

export function FocusTargetIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="12" cy="12" r="8.2" />
      <Circle cx="12" cy="12" r="4.8" />
      <Circle cx="12" cy="12" r="1.55" fill={props.color ?? DEFAULT_COLOR} stroke="none" />
    </Svg>
  );
}

export function FocusNotebookIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Path d="M6.5 5.4h8.8c1.2 0 2.2 1 2.2 2.2v10.9H8.7c-1.2 0-2.2-1-2.2-2.2V5.4Z" />
      <Path d="M8.7 18.5c0-1.2 1-2.2 2.2-2.2h6.6" />
      <Path d="M6.5 8.2H4.7" />
      <Path d="M6.5 11.5H4.7" />
      <Path d="M6.5 14.8H4.7" />
      <Path d="M10.4 9.2h4.2" />
      <Path d="M10.4 12h3.2" />
    </Svg>
  );
}

export function FocusClockIcon(props: IconProps) {
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="12" cy="12" r="8" />
      <Path d="M12 7.8v4.6l3.2 1.8" />
    </Svg>
  );
}

export function MoreDotsIcon(props: IconProps) {
  const color = props.color ?? DEFAULT_COLOR;
  return (
    <Svg {...iconProps(props)}>
      <Circle cx="6.5" cy="12" r="1.35" fill={color} stroke="none" />
      <Circle cx="12" cy="12" r="1.35" fill={color} stroke="none" />
      <Circle cx="17.5" cy="12" r="1.35" fill={color} stroke="none" />
    </Svg>
  );
}
