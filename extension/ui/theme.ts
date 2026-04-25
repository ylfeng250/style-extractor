/**
 * UI 主题配置
 */

export const theme = {
  bg: "#2c2c2c",
  text: "rgba(255, 255, 255, 0.9)",
  textSecondary: "rgba(255, 255, 255, 0.5)",
  textOnBrand: "#fff",
  brand: "#0d99ff",
  brandBg: "rgba(13, 153, 255, 0.15)",
  brandHover: "#3db8ff",
  brandPressed: "#0d99ff",
  success: "rgba(255, 255, 255, 0.9)",
  error: "#f24822",
  border: "rgba(255, 255, 255, 0.1)",
  secondaryHover: "rgba(255, 255, 255, 0.1)",
  secondaryPressed: "rgba(255, 255, 255, 0.15)",
  shadow: "0 1px 3px 0 rgba(0,0,0,.15),0 0 .5px 0 rgba(0,0,0,.3)",
  tooltipShadow: "0 2px 8px rgba(0,0,0,0.3)",
  fontFamily:
    '"Inter",ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif',
  fontSize: "12px",
  fontWeight: "500",
  lineHeight: "16px",
  letterSpacing: "0.005em",
  toolbarHeight: "40px",
  toolbarBorderRadius: "13px",
  buttonHeight: "24px",
  buttonBorderRadius: "5px",
  tooltipBorderRadius: "4px",
  highlightBorderRadius: "4px",
};

/** 主题配置类型 */
export interface ThemeConfig {
  bg: string;
  text: string;
  textSecondary: string;
  textOnBrand: string;
  brand: string;
  brandBg: string;
  brandHover: string;
  brandPressed: string;
  success: string;
  error: string;
  border: string;
  secondaryHover: string;
  secondaryPressed: string;
  shadow: string;
  tooltipShadow: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  toolbarHeight: string;
  toolbarBorderRadius: string;
  buttonHeight: string;
  buttonBorderRadius: string;
  tooltipBorderRadius: string;
  highlightBorderRadius: string;
}
