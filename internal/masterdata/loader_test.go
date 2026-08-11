package masterdata

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
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

func TestFetchMarksStoreReadyOnlyAfterCompleteSnapshot(t *testing.T) {
	dir := t.TempDir()
	store := NewStore(dir)
	if store.IsReady() {
		t.Fatal("new store must not be ready")
	}

	for _, filename := range []string{"events.json", "eventCards.json", "eventMusics.json", "virtualLives.json", "gachas.json"} {
		if err := os.WriteFile(filepath.Join(dir, filename), []byte("[]"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.Fetch(); err != nil {
		t.Fatal(err)
	}
	if !store.IsReady() || store.ReadinessError() != nil {
		t.Fatalf("ready = %v, error = %v, want complete ready snapshot", store.IsReady(), store.ReadinessError())
	}
}

func TestStartupRetryLoadsImmediately(t *testing.T) {
	dir := t.TempDir()
	for _, filename := range []string{"events.json", "eventCards.json", "eventMusics.json", "virtualLives.json", "gachas.json"} {
		if err := os.WriteFile(filepath.Join(dir, filename), []byte("[]"), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	store := NewStore(dir)
	store.StartRetryUntilReady(time.Hour)
	deadline := time.Now().Add(time.Second)
	for !store.IsReady() && time.Now().Before(deadline) {
		time.Sleep(time.Millisecond)
	}
	if !store.IsReady() {
		t.Fatal("startup loader did not attempt an immediate fetch")
	}
}
