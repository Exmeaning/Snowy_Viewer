use js_sys::Reflect;
use wasm_bindgen::{JsCast, JsValue, prelude::wasm_bindgen};
use web_sys::{CanvasRenderingContext2d, Document, HtmlCanvasElement, HtmlImageElement, window};

const ROW_HEIGHT: f64 = 44.0;
const ROW_GAP: f64 = 13.0;
const ROW_OVERDRAW: f64 = 2.0;
const MIN_ROWS: usize = 30;
const ROTATION_DEGREES: f64 = 30.0;
const SCROLL_DURATION_MS: f64 = 150_000.0;
const TILE_HEIGHT_RATIO: f64 = 1.0;
const SOURCE_VERTICAL_CROP_RATIO: f64 = 0.08;
const CANVAS_SPAN_MULTIPLIER: f64 = 1.7;
const MAX_DEVICE_PIXEL_RATIO: f64 = 1.5;
const BASE_WASH_OPACITY: f64 = 0.006;
const PRIMARY_OPACITY: f64 = 0.06;
const SECONDARY_OPACITY: f64 = 0.04;

#[wasm_bindgen]
pub struct BackgroundPatternRenderer {
    canvas: HtmlCanvasElement,
    context: CanvasRenderingContext2d,
    source_image: HtmlImageElement,
    tinted_tile: HtmlCanvasElement,
    theme_color: String,
    logical_width: f64,
    logical_height: f64,
    device_pixel_ratio: f64,
}

#[wasm_bindgen]
impl BackgroundPatternRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(
        canvas: HtmlCanvasElement,
        source_image: HtmlImageElement,
        theme_color: String,
    ) -> Result<BackgroundPatternRenderer, JsValue> {
        console_error_panic_hook::set_once();

        let context = canvas
            .get_context("2d")?
            .ok_or_else(|| JsValue::from_str("无法获取 2D canvas 上下文。"))?
            .dyn_into::<CanvasRenderingContext2d>()?;
        context.set_image_smoothing_enabled(true);

        let tinted_tile = create_canvas()?;

        let mut renderer = BackgroundPatternRenderer {
            canvas,
            context,
            source_image,
            tinted_tile,
            theme_color,
            logical_width: 0.0,
            logical_height: 0.0,
            device_pixel_ratio: 1.0,
        };
        renderer.rebuild_pattern()?;
        Ok(renderer)
    }

    pub fn resize(&mut self, width: f64, height: f64, device_pixel_ratio: f64) -> Result<(), JsValue> {
        self.logical_width = width.max(1.0);
        self.logical_height = height.max(1.0);
        self.device_pixel_ratio = clamp_dpr(device_pixel_ratio);

        self.canvas
            .set_width((self.logical_width * self.device_pixel_ratio).round() as u32);
        self.canvas
            .set_height((self.logical_height * self.device_pixel_ratio).round() as u32);
        self.context.set_image_smoothing_enabled(true);
        Ok(())
    }

    pub fn set_theme_color(&mut self, theme_color: String) -> Result<(), JsValue> {
        if self.theme_color == theme_color {
            return Ok(());
        }

        self.theme_color = theme_color;
        self.rebuild_pattern()
    }

    pub fn render(&self, timestamp_ms: f64) -> Result<(), JsValue> {
        let pixel_width = self.canvas.width() as f64;
        let pixel_height = self.canvas.height() as f64;
        if pixel_width <= 0.0 || pixel_height <= 0.0 {
            return Ok(());
        }

        let tile_width = self.tinted_tile.width() as f64;
        let tile_height = self.tinted_tile.height() as f64;
        if tile_width <= 0.0 || tile_height <= 0.0 {
            return Ok(());
        }

        self.context.set_transform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)?;
        self.context.clear_rect(0.0, 0.0, pixel_width, pixel_height);
        self.context.set_transform(
            self.device_pixel_ratio,
            0.0,
            0.0,
            self.device_pixel_ratio,
            0.0,
            0.0,
        )?;
        self.context.translate(self.logical_width * 0.5, self.logical_height * 0.5)?;
        self.context.rotate(ROTATION_DEGREES.to_radians())?;

        let span = self.logical_width.hypot(self.logical_height) * CANVAS_SPAN_MULTIPLIER;
        let row_spacing = ROW_HEIGHT + ROW_GAP;
        let draw_height = tile_height + ROW_OVERDRAW;
        let row_count = minimum_row_count(span, row_spacing);
        let base_offset = (timestamp_ms * self.scroll_speed()).rem_euclid(tile_width);

        self.context.save();
        self.context.set_global_alpha(BASE_WASH_OPACITY);
        set_fill_style(&self.context, &JsValue::from_str(&self.theme_color))?;
        self.context.fill_rect(-span, -span, span * 2.0, span * 2.0);
        self.context.restore();

        for index in 0..row_count {
            let centered_index = index as f64 - (row_count as f64 - 1.0) * 0.5;
            let y = centered_index * row_spacing;
            let reverse = index % 2 == 1;
            let opacity = if reverse { SECONDARY_OPACITY } else { PRIMARY_OPACITY };
            let offset = if reverse { base_offset } else { -base_offset };
            let normalized_offset = offset.rem_euclid(tile_width);
            let mut x = -span - tile_width + normalized_offset;

            self.context.save();
            self.context.translate(0.0, y)?;
            self.context.begin_path();
            self.context.rect(-span, -draw_height * 0.5, span * 2.0, draw_height);
            self.context.clip();
            self.context.set_global_alpha(opacity);

            while x < span {
                self.context.draw_image_with_html_canvas_element_and_dw_and_dh(
                    &self.tinted_tile,
                    x,
                    -tile_height * 0.5,
                    tile_width,
                    tile_height,
                )?;
                x += tile_width;
            }

            self.context.restore();
        }

        self.context.set_global_alpha(1.0);
        Ok(())
    }
}

impl BackgroundPatternRenderer {
    fn rebuild_pattern(&mut self) -> Result<(), JsValue> {
        let image_width = self.source_image.natural_width().max(1) as f64;
        let image_height = self.source_image.natural_height().max(1) as f64;
        let source_crop_y = (image_height * SOURCE_VERTICAL_CROP_RATIO).floor();
        let source_crop_height = (image_height - source_crop_y * 2.0).max(1.0);
        let target_height = ((ROW_HEIGHT + ROW_OVERDRAW) * TILE_HEIGHT_RATIO).round().max(1.0);
        let scale = target_height / source_crop_height;
        let target_width = (image_width * scale).round().max(1.0);

        self.tinted_tile.set_width(target_width as u32);
        self.tinted_tile.set_height(target_height as u32);

        let tile_context = self
            .tinted_tile
            .get_context("2d")?
            .ok_or_else(|| JsValue::from_str("无法获取离屏 canvas 上下文。"))?
            .dyn_into::<CanvasRenderingContext2d>()?;
        tile_context.set_image_smoothing_enabled(true);
        tile_context.set_global_alpha(1.0);
        tile_context.set_global_composite_operation("source-over")?;
        tile_context.clear_rect(0.0, 0.0, target_width, target_height);
        tile_context.draw_image_with_html_image_element_and_sw_and_sh_and_dx_and_dy_and_dw_and_dh(
            &self.source_image,
            0.0,
            source_crop_y,
            image_width,
            source_crop_height,
            0.0,
            0.0,
            target_width,
            target_height,
        )?;
        tile_context.set_global_composite_operation("source-in")?;
        set_fill_style(&tile_context, &JsValue::from_str(&self.theme_color))?;
        tile_context.fill_rect(0.0, 0.0, target_width, target_height);
        tile_context.set_global_composite_operation("source-over")?;

        Ok(())
    }

    fn scroll_speed(&self) -> f64 {
        (self.logical_width * 2.0 / SCROLL_DURATION_MS).max(0.001)
    }
}

fn create_canvas() -> Result<HtmlCanvasElement, JsValue> {
    document()?
        .create_element("canvas")?
        .dyn_into::<HtmlCanvasElement>()
        .map_err(Into::into)
}

fn document() -> Result<Document, JsValue> {
    window()
        .ok_or_else(|| JsValue::from_str("浏览器窗口不存在。"))?
        .document()
        .ok_or_else(|| JsValue::from_str("document 不存在。"))
}

fn set_fill_style(context: &CanvasRenderingContext2d, value: &JsValue) -> Result<(), JsValue> {
    Reflect::set(context.as_ref(), &JsValue::from_str("fillStyle"), value).map(|_| ())
}

fn clamp_dpr(device_pixel_ratio: f64) -> f64 {
    if !device_pixel_ratio.is_finite() {
        return 1.0;
    }

    device_pixel_ratio.clamp(1.0, MAX_DEVICE_PIXEL_RATIO)
}

fn minimum_row_count(span: f64, row_spacing: f64) -> usize {
    let dynamic_rows = (span / row_spacing).ceil() as usize + 6;
    dynamic_rows.max(MIN_ROWS)
}
