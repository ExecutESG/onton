"use client";
import { cn } from "@/utils";
import useWebApp from "@/hooks/useWebApp";
import { FC, useCallback, useEffect, useMemo } from "react";

export interface MainButtonProps {
  disabled?: boolean;
  color?: "primary" | "secondary";
  textColor?: string;
  text?: string;
  onClick?: () => void;
  progress?: boolean;
  buttonType?: "MainButton" | "SecondaryButton";
}

const MainButton: FC<MainButtonProps> = ({
  disabled = false,
  color,
  textColor,
  text,
  onClick,
  progress = false,
  buttonType = "MainButton",
}) => {
  const WebApp = useWebApp();

  const buttonParams = useMemo(
    () => ({
      color: color === "primary" ? "#2ea6ff" : color === "secondary" ? "#747480" : undefined,
      text_color: textColor,
    }),
    [color, textColor]
  );

  const updateButton = useCallback(() => {
    if (!WebApp) return;

    const { button_color, button_text_color } = WebApp.themeParams;

    if (text) {
      WebApp[buttonType].setText(text);
      WebApp[buttonType].show();
    } else {
      WebApp[buttonType].hide();
    }

    WebApp[buttonType].setParams({
      color: buttonParams.color || button_color,
      text_color: buttonParams.text_color || button_text_color,
    });

    if (progress) {
      WebApp[buttonType].showProgress();
    } else {
      WebApp[buttonType].hideProgress();
    }

    if (disabled || progress) {
      WebApp[buttonType].disable();
    } else {
      WebApp[buttonType].enable();
    }
  }, [WebApp, text, buttonParams, disabled, progress]);

  useEffect(() => {
    if (!WebApp) return;

    updateButton();

    if (onClick) {
      WebApp[buttonType].onClick(onClick);
    }

    return () => {
      WebApp[buttonType].hide();
      WebApp[buttonType].enable();
      WebApp[buttonType].hideProgress();
      WebApp[buttonType].setParams({
        color: WebApp.themeParams.button_color,
        text_color: WebApp.themeParams.button_text_color,
      });
      if (onClick) {
        WebApp[buttonType].offClick(onClick);
      }
    };
  }, [WebApp, updateButton, onClick, progress, disabled, buttonParams, text, color, textColor]);

  // If running in a web browser without Telegram initData, render sticky on-screen fallback
  if (!WebApp || !WebApp.initData) {
    if (!text) return null;
    return (
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 z-40 flex items-center justify-center">
        <button
          type="button"
          disabled={disabled || progress}
          onClick={onClick}
          className={cn(
            "w-full max-w-xl py-3.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-md flex items-center justify-center gap-2",
            color === "secondary"
              ? "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              : "bg-primary hover:bg-primary-hover text-white active:scale-[0.99]",
            (disabled || progress) && "opacity-50 cursor-not-allowed"
          )}
        >
          {progress && <span className="animate-spin mr-1">⏳</span>}
          {text}
        </button>
      </div>
    );
  }

  return null;
};

export default MainButton;
