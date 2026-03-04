import React from "react";

const variantClasses = {
  warning: "bg-yellow-600",
  error: "bg-red-600",
  info: "bg-blue-600",
};

export function CallBanner({ visible, variant = "warning", children }) {
  if (!visible) return null;

  const classes = variantClasses[variant] || variantClasses.warning;

  return (
    <div
      className={`${classes} px-4 py-2 text-center text-sm font-medium text-white`}
    >
      {children}
    </div>
  );
}

/**
 * Stack of device fallback banners. Each banner is non-modal, auto-dismissing.
 * Uses role="status" + aria-live for screen reader announcements.
 */
export function DeviceFallbackBanners({ banners, onDismiss }) {
  if (!banners || banners.length === 0) return null;

  return (
    <>
      {banners.map((banner) => {
        const classes = variantClasses[banner.variant] || variantClasses.warning;
        return (
          <div
            key={banner.id}
            role="status"
            aria-live="polite"
            data-test="deviceFallbackBanner"
            data-device-type={banner.deviceType}
            className={`flex items-center justify-between ${classes} px-4 py-2 text-sm font-medium text-white`}
          >
            <span>{banner.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              data-test="bannerDismiss"
              onClick={() => onDismiss(banner.id)}
              className="ml-2 flex-shrink-0 rounded p-1 hover:bg-black/20"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        );
      })}
    </>
  );
}

/**
 * Container that stacks CallBanner + DeviceFallbackBanners at the top of the
 * call area. Uses a single absolute-positioned flex column so banners never
 * overlap each other.
 */
export function BannerStack({ children }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-10 flex flex-col">
      {children}
    </div>
  );
}
