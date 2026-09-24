export const REASONS_MAP: Record<string, { labelEn: string; labelVi: string }> = {
  wrong_item: { labelEn: "Wrong item delivered", labelVi: "Giao sai sản phẩm" },
  damaged_item: { labelEn: "Defective or damaged", labelVi: "Sản phẩm lỗi hoặc hư hỏng" },
  wrong_size: { labelEn: "Wrong size or option", labelVi: "Không vừa kích cỡ / phân loại" },
  wrong_color: { labelEn: "Wrong color delivered", labelVi: "Giao sai màu sắc" },
  changed_mind: { labelEn: "No longer needed", labelVi: "Không còn nhu cầu sử dụng" },
  poor_quality: { labelEn: "Poor quality", labelVi: "Chất lượng sản phẩm kém" },
  other: { labelEn: "Other reasons", labelVi: "Lý do khác" }
};

export function getReasonTranslation(reason: string): string {
  if (!reason) return "Chưa xác định";
  const matched = REASONS_MAP[reason];
  return matched ? matched.labelVi : reason;
}
