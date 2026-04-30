管理者トップページ・共通サイドバー追加版

配置するファイル:
- app/admin/AdminAuthGuard.tsx
- app/admin/AdminShell.tsx
- app/admin/layout.tsx
- app/admin/page.tsx
- app/admin/monthly-headcount/layout.tsx

ポイント:
1. /admin に管理トップページを追加します。
2. /admin 配下全体に共通サイドバー・ヘッダーを表示します。
3. 既存の app/admin/monthly-headcount/layout.tsx は、二重サイドバー防止のため pass-through にしています。
4. 既存の /admin/users、/admin/monthly-headcount/* はそのまま利用できます。

配置後:
Ctrl + C
npm run dev

確認URL:
http://localhost:3000/admin
