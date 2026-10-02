// Tách tên món / đoạn text thành tag vị (không AI, không token).
// Quy tắc: thường hóa + tách từ + bỏ stopword + bỏ số. Dùng chung cho
// ghi tín hiệu lẫn đọc taste, nên hai chiều luôn khớp nhau.

const STOPWORDS = new Set(
  'món với và của các cho từ trong ngoài một những là có được khi để này kia đó theo như hoặc hay rất quá hơn nhất cũng đã sẽ đang bị vì nên mà thì ở tại bằng về lên xuống ra vào ăn uống thêm bớt cùng thực đơn bữa kèm phần the and with of a an to for or'.split(
    ' ',
  ),
);

const MAX_TOKENS = 15;

export function tokenizeTaste(input: string): string[] {
  const words = input
    .toLowerCase()
    .split(
      /[^a-zàáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ0-9]+/gu,
    )
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].slice(0, MAX_TOKENS);
}
