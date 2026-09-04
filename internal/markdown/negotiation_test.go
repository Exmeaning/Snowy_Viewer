package markdown

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestIsMarkdownRequest(t *testing.T) {
	tests := []struct {
		method string
		accept string
		want   bool
	}{
		{"GET", "text/markdown", true},
		{"GET", "text/markdown, text/html;q=0.9", true},
		{"GET", "text/html,application/xhtml+xml", false},
		{"POST", "text/markdown", false},
		{"GET", "", false},
	}

	for _, tt := range tests {
		req, _ := http.NewRequest(tt.method, "http://localhost/zh-cn/", nil)
		if tt.accept != "" {
			req.Header.Set("Accept", tt.accept)
		}
		if got := IsMarkdownRequest(req); got != tt.want {
			t.Errorf("IsMarkdownRequest(%s, %s) = %v, want %v", tt.method, tt.accept, got, tt.want)
		}
	}
}

func TestConvertHTMLToMarkdown_DetailPage(t *testing.T) {
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>宵崎奏 - Shadow Shadow | Moesekai</title>
    <meta name="description" content="宵崎奏 - Shadow Shadow 卡牌资料与数值分析">
</head>
<body>
    <article class="sr-only" aria-label="宵崎奏 - Shadow Shadow">
        <h1>宵崎奏 - Shadow Shadow</h1>
        <p>宵崎奏 - Shadow Shadow | rarity_4 | happy | 配信日: 2026-09-03</p>
        <table>
            <caption>カードパラメータ (Card Parameters)</caption>
            <thead>
                <tr>
                    <th scope="col">状態</th>
                    <th scope="col">パフォーマンス (Performance)</th>
                    <th scope="col">テクニック (Technique)</th>
                    <th scope="col">スタミナ (Stamina)</th>
                    <th scope="col">総合力 (Total Power)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>通常 / 特訓前</td>
                    <td>11534</td>
                    <td>11534</td>
                    <td>11534</td>
                    <td>34602</td>
                </tr>
            </tbody>
        </table>
        <dl>
            <dt>スキル名</dt>
            <dd>刺す音に酔う</dd>
            <dt>スキル説明</dt>
            <dd>7秒間 BAD以上がPERFECTになり、5秒間 スコアが100％UPする</dd>
        </dl>
    </article>
</body>
</html>`

	md := ConvertHTMLToMarkdown(htmlContent, "/ja-jp/cards/1462/")

	if !strings.Contains(md, "# 宵崎奏 - Shadow Shadow | Moesekai") {
		t.Errorf("Missing title heading in markdown: %s", md)
	}
	if !strings.Contains(md, "> 宵崎奏 - Shadow Shadow 卡牌资料与数值分析") {
		t.Errorf("Missing blockquote description in markdown: %s", md)
	}
	if !strings.Contains(md, "### カードパラメータ (Card Parameters)") {
		t.Errorf("Missing table caption in markdown: %s", md)
	}
	if !strings.Contains(md, "| 状態 | パフォーマンス (Performance) | テクニック (Technique) | スタミナ (Stamina) | 総合力 (Total Power) |") {
		t.Errorf("Missing table header in markdown: %s", md)
	}
	if !strings.Contains(md, "| 通常 / 特訓前 | 11534 | 11534 | 11534 | 34602 |") {
		t.Errorf("Missing table row in markdown: %s", md)
	}
	if !strings.Contains(md, "- **スキル名**: 刺す音に酔う") {
		t.Errorf("Missing skill name in markdown: %s", md)
	}
	if !strings.Contains(md, "- **スキル説明**: 7秒間 BAD以上がPERFECTになり、5秒間 スコアが100％UPする") {
		t.Errorf("Missing skill description in markdown: %s", md)
	}
	if !strings.Contains(md, "https://pjsk.moe/api/mcp") {
		t.Errorf("Missing MCP discovery link in markdown: %s", md)
	}
}

func TestConvertHTMLToMarkdown_HomePage(t *testing.T) {
	htmlContent := `<!DOCTYPE html>
<html>
<head>
    <title>Moesekai - Project SEKAI Wiki</title>
    <meta name="description" content="Project SEKAI 综合查看器">
</head>
<body>
    <div>Welcome to Moesekai</div>
</body>
</html>`

	md := ConvertHTMLToMarkdown(htmlContent, "/zh-cn/")

	if !strings.Contains(md, "# Moesekai - Project SEKAI Wiki") {
		t.Errorf("Missing title in markdown: %s", md)
	}
	if !strings.Contains(md, "> Project SEKAI 综合查看器") {
		t.Errorf("Missing description in markdown: %s", md)
	}
	if !strings.Contains(md, "[卡牌图鉴](/zh-cn/cards/)") {
		t.Errorf("Missing card navigation in markdown: %s", md)
	}
	if !strings.Contains(md, "https://pjsk.moe/api/mcp") {
		t.Errorf("Missing MCP discovery link in markdown: %s", md)
	}
}

func TestNegotiationMiddleware(t *testing.T) {
	backend := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`<html><head><title>Test Page</title><meta name="description" content="Test Desc"></head><body><h1>Hello</h1></body></html>`))
	})

	handler := NewNegotiationMiddleware(backend)

	// 1. Regular HTML request
	req1, _ := http.NewRequest("GET", "http://localhost/zh-cn/", nil)
	rec1 := httptest.NewRecorder()
	handler.ServeHTTP(rec1, req1)
	if rec1.Header().Get("Content-Type") != "text/html; charset=utf-8" {
		t.Errorf("Expected text/html, got %s", rec1.Header().Get("Content-Type"))
	}

	// 2. Markdown request
	req2, _ := http.NewRequest("GET", "http://localhost/zh-cn/", nil)
	req2.Header.Set("Accept", "text/markdown")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Header().Get("Content-Type") != "text/markdown; charset=utf-8" {
		t.Errorf("Expected text/markdown, got %s", rec2.Header().Get("Content-Type"))
	}
	body := rec2.Body.String()
	if !strings.Contains(body, "# Test Page") {
		t.Errorf("Markdown missing heading: %s", body)
	}
}
