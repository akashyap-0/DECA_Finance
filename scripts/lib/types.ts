export interface Segment {
  x: number;
  text: string;
}

export interface Line {
  y: number;
  segments: Segment[];
}

export interface Page {
  number: number;
  width: number;
  height: number;
  lines: Line[];
}
