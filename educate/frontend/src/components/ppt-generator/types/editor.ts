/**
 * Normalized Slide-Object Model (SOM) TypeScript interfaces for Visual Editor (Phase 2.2).
 * Mirrors backend Pydantic models in app/models.py.
 */

export interface TextRunDTO {
  run_index: number;
  text: string;
  font_family?: string | null;
  font_size?: number | null; // pt
  font_color?: string | null; // hex #RRGGBB
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  strikethrough?: boolean | null;
  hyperlink?: string | null;
}

export interface TextParagraphDTO {
  paragraph_index: number;
  runs: TextRunDTO[];
  alignment?: string | null; // "left", "center", "right", "justify"
  line_spacing?: number | null;
  space_before?: number | null;
  space_after?: number | null;
  level: number;
  bullet_char?: string | null;
  is_bullet: boolean;
}

export interface TextContentDTO {
  paragraphs: TextParagraphDTO[];
  vertical_alignment?: string | null; // "top", "middle", "bottom"
  word_wrap?: boolean | null;
  margin_left?: number | null;
  margin_right?: number | null;
  margin_top?: number | null;
  margin_bottom?: number | null;
}

export interface FillDTO {
  fill_type: string; // "solid", "gradient", "pattern", "texture", "background", "none", "theme", "unsupported"
  color?: string | null; // hex #RRGGBB
  alpha?: number | null; // 0.0 to 1.0
}

export interface BorderDTO {
  color?: string | null; // hex #RRGGBB
  width?: number | null; // points
  width_emu?: number | null;
  style?: string | null; // "solid", "dashed", "none"
}

export interface ImageCropDTO {
  x: number; // Source pixel X offset (>= 0)
  y: number; // Source pixel Y offset (>= 0)
  width: number; // Source pixel crop width (> 0)
  height: number; // Source pixel crop height (> 0)
}

export interface ImageAssetDTO {
  asset_id: string;
  url: string; // e.g. /api/editor/assets/{file_id}/{asset_id} or blob: URL for local
  content_type: string;
  original_filename?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  is_local?: boolean; // True for newly uploaded in-memory client assets
}

export interface TableCellDTO {
  row_index: number;
  col_index: number;
  text: string;
  text_content?: TextContentDTO | null;
  fill?: FillDTO | null;
}

export interface TableDataDTO {
  rows: number;
  columns: number;
  cells: TableCellDTO[];
}

export type SlideObjectType =
  | 'text_box'
  | 'shape'
  | 'picture'
  | 'table'
  | 'group'
  | 'connector'
  | 'unsupported';

export interface SlideObjectDTO {
  object_id: string;
  name: string;
  object_type: SlideObjectType;
  shape_type?: string | null; // e.g. "RECTANGLE", "ROUNDED_RECTANGLE", "OVAL"
  x: number; // Virtual canvas coordinates (1920x1080 default)
  y: number;
  width: number;
  height: number;
  x_emu: number; // Native PowerPoint EMUs
  y_emu: number;
  width_emu: number;
  height_emu: number;
  rotation: number; // degrees
  z_index: number; // document order
  fill?: FillDTO | null;
  border?: BorderDTO | null;
  text_content?: TextContentDTO | null;
  image_asset?: ImageAssetDTO | null;
  crop?: ImageCropDTO | null;
  table_data?: TableDataDTO | null;
  is_unsupported: boolean;
  unsupported_reason?: string | null;
}

export interface SlideDetailDTO {
  slide_id: string;
  slide_number: number;
  width: number;
  height: number;
  background_color?: string | null;
  background_type: string;
  speaker_notes: string;
  layout_name?: string | null;
  theme?: string | null;
  objects: SlideObjectDTO[];
}

export interface PresentationEditorModel {
  file_id: string;
  title: string;
  slide_width: number;
  slide_height: number;
  slide_width_emu: number;
  slide_height_emu: number;
  scale_x: number;
  scale_y: number;
  slide_count: number;
  theme?: string | null;
  layout_style?: string | null;
  slides: SlideDetailDTO[];
  source_metadata: Record<string, any>;
}

export interface ThemeOption {
  id: string;
  display_name: string;
  description: string;
  is_dark: boolean;
  is_custom?: boolean;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    muted: string;
  };
  typography: {
    font_heading: string;
    font_body: string;
  };
}

export interface LayoutOption {
  id: string;
  display_name: string;
  description: string;
  recommended_for: string;
}
