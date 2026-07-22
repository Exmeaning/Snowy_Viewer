package masterdata

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFetchJSONRejectsOversizedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Length", fmt.Sprint(maxMasterDataBytes+1))
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	var target map[string]any
	err := fetchJSON(server.URL, &target)
	if err == nil || !strings.Contains(err.Error(), "exceeds") {
		t.Fatalf("fetchJSON error = %v, want size-bound rejection", err)
	}
}

func TestLoadOrFetchRejectsOversizedLocalFileAndFallsBack(t *testing.T) {
	dir := t.TempDir()
	localPath := filepath.Join(dir, "events.json")
	file, err := os.Create(localPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := file.Truncate(maxMasterDataBytes + 1); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"source":"remote"}`)
	}))
	defer server.Close()

	store := NewStore(dir)
	var target map[string]string
	if err := store.loadOrFetch("events.json", server.URL, &target); err != nil {
		t.Fatal(err)
	}
	if target["source"] != "remote" {
		t.Fatalf("target = %#v, want bounded local fallback to remote", target)
	}
}
