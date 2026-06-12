// Configuration and shared constants for the photo ledger PWA.
// 分離した設定値や保存処理を定義しています。将来、SharePoint Lists 等へ保存する場合はここを改修します。

/* 定数: 入力行数や圧縮プリセット */
const NOTE_LINES = 5;
const PRESETS = {
  large: {
    label: '大（強く圧縮・軽量）',
    range: '約80〜180KB/枚',
    maxW: 1000,
    maxH: 1000,
    quality: 0.68
  },
  middle: {
    label: '中（標準）',
    range: '約150〜350KB/枚',
    maxW: 1400,
    maxH: 1400,
    quality: 0.78
  },
  small: {
    label: '小（軽く圧縮・画質優先）',
    range: '約300〜700KB/枚',
    maxW: 1800,
    maxH: 1800,
    quality: 0.86
  }
};

/**
 * 入力データ(JSON)を保存する共通処理。
 * 現在はブラウザでファイルダウンロードする実装です。
 * 将来的にSharePoint Listsなどへ保存する場合は、この関数を改修してください。
 * @param {Object} data 出力するデータオブジェクト
 */
function saveInputData(data) {
  // ファイル名生成（日付はYYYYMMDD形式）
  const d = new Date();
  const dateStr = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const site = (data.cover.siteName || '現場名未入力').replace(/[\\/:*?"<>|\s]+/g, '_');
  const fileName = site + '_工事写真台帳_入力データ_' + dateStr + '.json';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  // ブラウザ互換ダウンロード処理
  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(blob, fileName);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 600);
  }
}

// 将来的にSharePointなどの外部連携を追加する場合は以下に関数を追加してください。
// 例:
// async function saveToSharePointLists(data) {
//   // TODO: API 経由でデータ送信
// }