import { LaunchType, Toast, getSelectedText, launchCommand, showToast } from "@raycast/api";

export default async function Command() {
  try {
    const selectedText = await getSelectedText();

    if (!selectedText || selectedText.trim() === "") {
      await showToast({
        style: Toast.Style.Failure,
        title: "選択テキストがありません",
        message: "テキストを選択してから再度お試しください。",
      });
      return;
    }

    await launchCommand({
      name: "my-raycast-translate",
      type: LaunchType.UserInitiated,
      context: {
        selectedText,
        nonce: Date.now(),
      },
    });
  } catch {
    await showToast({
      style: Toast.Style.Failure,
      title: "選択テキストを取得できませんでした",
      message: "他のアプリでテキストを選択してから再度お試しください。",
    });
  }
}
