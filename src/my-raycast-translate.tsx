import {
  Detail,
  ActionPanel,
  Action,
  getSelectedText,
  getPreferenceValues,
  showToast,
  Toast,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";

interface Preferences {
  geminiApiKey: string;
}

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export default function Command() {
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    translateSelectedText();
  }, []);

  async function translateSelectedText() {
    setIsLoading(true);
    setError(null);

    try {
      const selectedText = await getSelectedText();

      if (!selectedText || selectedText.trim() === "") {
        setError("テキストが選択されていません。テキストを選択してから再度お試しください。");
        setIsLoading(false);
        return;
      }

      const preferences = getPreferenceValues<Preferences>();
      const apiKey = preferences.geminiApiKey;

      if (!apiKey) {
        setError("Gemini APIキーが設定されていません。拡張機能の設定からAPIキーを入力してください。");
        setIsLoading(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `You are a professional translator. Analyze the following text and translate it:

1. If the text is in Japanese, translate it to English.
2. If the text is in any other language, translate it to Japanese.

Important instructions:
- Only output the translation, nothing else
- Preserve the original formatting (line breaks, bullet points, etc.)
- Maintain the tone and style of the original text

Text to translate:
${selectedText}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-lite",
        contents: prompt,
      });

      const translatedText = response.text || "";

      const isJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(selectedText);

      setResult({
        originalText: selectedText,
        translatedText: translatedText.trim(),
        sourceLanguage: isJapanese ? "日本語" : "Other",
        targetLanguage: isJapanese ? "English" : "日本語",
      });

      await showToast({
        style: Toast.Style.Success,
        title: "翻訳完了",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "不明なエラーが発生しました";

      if (errorMessage.includes("no text selected") || errorMessage.includes("frontmost application")) {
        setError("選択テキストを取得できませんでした。他のアプリでテキストを選択してから再度お試しください。");
      } else if (errorMessage.includes("API key") || errorMessage.includes("401") || errorMessage.includes("403")) {
        setError("APIキーが無効です。設定でGemini APIキーを確認してください。");
      } else {
        setError(`翻訳に失敗しました: ${errorMessage}`);
      }

      await showToast({
        style: Toast.Style.Failure,
        title: "翻訳失敗",
        message: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  }

  function generateMarkdown(): string {
    if (error) {
      return `# エラー\n\n${error}`;
    }

    if (!result) {
      return "# 翻訳中...\n\nしばらくお待ちください。";
    }

    return `${result.translatedText}

---

**原文** (${result.sourceLanguage})
\`\`\`
${result.originalText}
\`\`\`
`;
  }

  return (
    <Detail
      isLoading={isLoading}
      markdown={generateMarkdown()}
      actions={
        result && !error ? (
          <ActionPanel>
            <Action.CopyToClipboard
              title="翻訳をコピー"
              content={result.translatedText}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.Paste
              title="翻訳をペースト"
              content={result.translatedText}
              shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            />
            <Action.CopyToClipboard
              title="原文をコピー"
              content={result.originalText}
              shortcut={{ modifiers: ["cmd", "opt"], key: "c" }}
            />
            <Action
              title="再翻訳"
              onAction={translateSelectedText}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel>
        ) : (
          <ActionPanel>
            <Action
              title="再試行"
              onAction={translateSelectedText}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel>
        )
      }
    />
  );
}
