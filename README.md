# ITホワイトボード

ネットワーク構成図・セキュリティ説明・業務フローなどを、複数人で同時に描けるセルフホスト型ホワイトボードです。

- **依存パッケージなし**：Node.js 18 以上だけで動きます（`npm install` 不要）
- データはサーバの `data/` に JSON で保存されます（DB不要）

## 主な機能

| 要件 | 実装 |
|---|---|
| 拡大・縮小 | ホイール / トラックパッドのピンチ / タッチのピンチ、5%〜800%。「全体」で全要素にフィット |
| 同時編集 | WebSocket でリアルタイム同期。他の人のカーソル・選択中の要素が名前付きで表示 |
| エクスポート | PowerPoint (.pptx・編集可能な図形 or 画像)、PNG / JPEG（1〜4倍）、SVG、JSON。**フレーム1つ＝スライド1枚**で出力 |
| 自動保存 | 変更は即時サーバへ送信し 1.5 秒以内にファイル保存。数分ごとにスナップショットを残し「履歴」から復元可。オフライン中の変更は再接続時に自動送信 |
| ITアイコン | 人・端末・サーバ・ネットワーク・セキュリティ・メール/データの 6 分類 62 種。検索可。自社ロゴ等の画像を「＋登録」で全員共有のパレットに追加可 |
| 文字 | フォント 9 種（ゴシック/メイリオ/游ゴシック/BIZ UDP/丸ゴシック/明朝/Arial/等幅/手書き風）、サイズ、太字・斜体・下線、色、左右揃え |
| パレットの大きさ | アイコンパレットは右端ドラッグで幅を変更、下のスライダーでアイコン表示サイズを変更、折りたたみ可。キャンバス自体は無限 |

その他：四角・円・ひし形・矢印・線・ペン・テキスト・付箋・フレーム・消しゴム、画像の貼り付け/ドラッグ&ドロップ、
**矢印をアイコンや図形の上から引くと自動接続**（動かしても線が追従）、整列・等間隔配置、重なり順、Undo/Redo、コピー&ペースト。

## 起動

```bash
cd whiteboard
node server.js             # http://127.0.0.1:3100
# 環境変数: PORT=3100 HOST=127.0.0.1 DATA_DIR=./data SNAPSHOT_MIN=5 SNAPSHOT_KEEP=100
```

社内LANから直接使う場合は `HOST=0.0.0.0` にしてください。

### systemd

`/etc/systemd/system/whiteboard.service`

```ini
[Unit]
Description=IT Whiteboard
After=network.target

[Service]
WorkingDirectory=/opt/whiteboard
ExecStart=/usr/bin/node /opt/whiteboard/server.js
Environment=PORT=3100 HOST=127.0.0.1
User=whiteboard
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /sbin/nologin whiteboard
sudo chown -R whiteboard: /opt/whiteboard
sudo systemctl daemon-reload && sudo systemctl enable --now whiteboard
```

停止時（SIGTERM）は未保存分を書き出してから終了します。

### Apache でサブパス公開（例: https://example.co.jp/whiteboard/）

アプリ側の設定は不要です（URL はすべて相対パス）。`mod_proxy` / `mod_proxy_http` / `mod_proxy_wstunnel` を有効にして：

```apache
# Apache 2.4.47 以降
RedirectMatch ^/whiteboard$ /whiteboard/
ProxyPass        /whiteboard/ http://127.0.0.1:3100/ upgrade=websocket
ProxyPassReverse /whiteboard/ http://127.0.0.1:3100/

# 2.4.46 以前は upgrade=websocket の代わりに
# RewriteEngine On
# RewriteCond %{HTTP:Upgrade} websocket [NC]
# RewriteRule ^/whiteboard/(.*) ws://127.0.0.1:3100/$1 [P,L]
```

アクセス制限（Basic認証・社内IP制限など）は Apache 側で `<Location /whiteboard/>` に設定してください。
アプリ自体には認証がありません。

### nginx の場合

```nginx
location /whiteboard/ {
    proxy_pass http://127.0.0.1:3100/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 1h;
    client_max_body_size 16m;
}
```

## 使い方のコツ

- **ショートカット**：V 選択 / H パン / R 四角 / O 円 / D ひし形 / A 矢印 / L 線 / P ペン / T テキスト / S 付箋 / F フレーム / E 消しゴム
- Space+ドラッグ・中ボタンドラッグで画面移動、Shift+1 で全体表示、Ctrl+0 で 100%
- ダブルクリック or Enter で文字入力（図形・付箋・アイコンのラベル・線のラベルも）。Esc で確定
- Shift+ドラッグで正方形・水平垂直線、Alt+ドラッグで複製、Ctrl+D 複製、矢印キーで微調整
- 右クリック →「ホイールで拡大縮小」を切り替えるとホイール＝スクロールになります（Ctrl+ホイールで拡大縮小）
- スライドにしたい範囲を **フレーム（F）** で囲む → エクスポート →「すべてのフレーム」で 1 フレーム＝1 スライドの pptx になります。フレームの初期サイズは 16:9
- pptx の「編集できる図形」モードでは四角/円/線/矢印/文字は PowerPoint 上で編集可能、アイコンとペン描画は透過PNGで配置されます

## データ

```
data/
  boards/<id>.json      ボード本体（自動保存）
  history/<id>/*.json   スナップショット
  assets/               アップロード画像（ハッシュ名）・meta.json
  trash/                削除したボード（ここから戻せます）
```

バックアップは `data/` ディレクトリをコピーするだけです。

## ファイル構成

```
server.js               サーバ（HTTP/REST/WebSocket/自動保存）
public/index.html       画面
public/app.js           クライアント
public/icons.js         ITアイコン定義（ICONS に追加すればパレットに出ます）
public/vendor/pptxgen.bundle.js   PptxGenJS 4.0.1（MIT, pptx 出力用）
```
# whiteboard
