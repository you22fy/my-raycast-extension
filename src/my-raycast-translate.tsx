import {
  Detail,
  ActionPanel,
  Action,
  getSelectedText,
  getPreferenceValues,
  showToast,
  Toast,
  LaunchProps,
} from "@raycast/api";
import { usePromise } from "@raycast/utils";
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

type TranslationLaunchContext = {
  selectedText?: string;
  nonce?: number;
};

async function translateText(selectedTextOverride?: string | null, _nonce?: number | null): Promise<TranslationResult> {
  const selectedText =
    typeof selectedTextOverride === "string" ? selectedTextOverride : await getSelectedText();

  if (!selectedText || selectedText.trim() === "") {
    throw new Error("テキストが選択されていません。テキストを選択してから再度お試しください。");
  }

  const preferences = getPreferenceValues<Preferences>();
  const apiKey = preferences.geminiApiKey;

  if (!apiKey) {
    throw new Error("Gemini APIキーが設定されていません。拡張機能の設定からAPIキーを入力してください。");
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
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const translatedText = response.text || "";
  const isJapanese = /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(selectedText);

  await showToast({
    style: Toast.Style.Success,
    title: "翻訳完了",
  });

  return {
    originalText: selectedText,
    translatedText: translatedText.trim(),
    sourceLanguage: isJapanese ? "日本語" : "Other",
    targetLanguage: isJapanese ? "English" : "日本語",
  };
}

export default function Command(props: LaunchProps<{ launchContext?: TranslationLaunchContext }>) {
  const launchContext = props.launchContext;
  const { isLoading, data: result, error, revalidate } = usePromise(translateText, [
    launchContext?.selectedText ?? null,
    launchContext?.nonce ?? null,
  ]);
  function generateMarkdown(): string {
    if (error) {
      const errorMessage = error.message;
      if (errorMessage.includes("no text selected") || errorMessage.includes("frontmost application")) {
        return "# エラー\n\n選択テキストを取得できませんでした。他のアプリでテキストを選択してから再度お試しください。";
      }
      if (errorMessage.includes("API key") || errorMessage.includes("401") || errorMessage.includes("403")) {
        return "# エラー\n\nAPIキーが無効です。設定でGemini APIキーを確認してください。";
      }
      return `# エラー\n\n${errorMessage}`;
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
              onAction={() => revalidate()}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel>
        ) : (
          <ActionPanel>
            <Action
              title="再試行"
              onAction={() => revalidate()}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel>
        )
      }
    />
  );
}
