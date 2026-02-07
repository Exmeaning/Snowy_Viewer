package bilibili

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"snowy_viewer/internal/cache"
)

// WbiKeys stores Bilibili WBI authentication keys
type WbiKeys struct {
	Img            string
	Sub            string
	Mixin          string
	lastUpdateTime time.Time
}

type NavResponse struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    struct {
		WbiImg struct {
			ImgUrl string `json:"img_url"`
			SubUrl string `json:"sub_url"`
		} `json:"wbi_img"`
	} `json:"data"`
}

var mixinKeyEncTab = []int{
	46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
	33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
	61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
	36, 20, 34, 44, 52,
}

// Client handles Bilibili API requests
type Client struct {
	httpClient   *http.Client
	wbiKeys      WbiKeys
	wbiMutex     sync.RWMutex
	cache        *cache.Cache
	sessData     string
	cookieString string
}

// NewClient creates a new Bilibili client
func NewClient(c *cache.Cache, sessData, cookieString string) *Client {
	jar, _ := cookiejar.New(nil)
	client := &Client{
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
			Jar:     jar,
		},
		cache:        c,
		sessData:     sessData,
		cookieString: cookieString,
	}

	// Initial cookie fetch
	go func() {
		req, _ := http.NewRequest("GET", "https://www.bilibili.com/", nil)
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
		resp, err := client.httpClient.Do(req)
		if err == nil {
			defer resp.Body.Close()
			fmt.Println("Initialized Bilibili cookies")
		} else {
			fmt.Printf("Failed to init cookies: %v\n", err)
		}
	}()

	return client
}

func (c *Client) getWbiKeys() (WbiKeys, error) {
	c.wbiMutex.RLock()
	if time.Since(c.wbiKeys.lastUpdateTime) < 1*time.Hour && c.wbiKeys.Mixin != "" {
		defer c.wbiMutex.RUnlock()
		return c.wbiKeys, nil
	}
	c.wbiMutex.RUnlock()

	c.wbiMutex.Lock()
	defer c.wbiMutex.Unlock()

	// Double check after lock
	if time.Since(c.wbiKeys.lastUpdateTime) < 1*time.Hour && c.wbiKeys.Mixin != "" {
		return c.wbiKeys, nil
	}

	req, err := http.NewRequest("GET", "https://api.bilibili.com/x/web-interface/nav", nil)
	if err != nil {
		return WbiKeys{}, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return WbiKeys{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return WbiKeys{}, fmt.Errorf("nav api status: %s", resp.Status)
	}

	var nav NavResponse
	if err := json.NewDecoder(resp.Body).Decode(&nav); err != nil {
		return WbiKeys{}, err
	}

	imgUrl := nav.Data.WbiImg.ImgUrl
	subUrl := nav.Data.WbiImg.SubUrl

	if imgUrl == "" || subUrl == "" {
		return WbiKeys{}, fmt.Errorf("empty wbi urls")
	}

	imgKey := strings.TrimSuffix(filepath.Base(imgUrl), ".png")
	subKey := strings.TrimSuffix(filepath.Base(subUrl), ".png")

	// Generate Mixin Key
	rawWbiKey := imgKey + subKey
	var mixin []byte
	for _, index := range mixinKeyEncTab {
		if index < len(rawWbiKey) {
			mixin = append(mixin, rawWbiKey[index])
		}
	}

	c.wbiKeys.Img = imgKey
	c.wbiKeys.Sub = subKey
	c.wbiKeys.Mixin = string(mixin[:32])
	c.wbiKeys.lastUpdateTime = time.Now()

	return c.wbiKeys, nil
}

func (c *Client) signWbi(params url.Values) (string, error) {
	keys, err := c.getWbiKeys()
	if err != nil {
		return "", err
	}

	params.Set("wts", strconv.FormatInt(time.Now().Unix(), 10))

	// Sort keys
	keysList := make([]string, 0, len(params))
	for k := range params {
		keysList = append(keysList, k)
	}
	sort.Strings(keysList)

	queryStr := params.Encode()

	// Calculate w_rid
	hash := md5.Sum([]byte(queryStr + keys.Mixin))
	w_rid := hex.EncodeToString(hash[:])

	params.Set("w_rid", w_rid)
	return params.Encode(), nil
}

// FetchDynamic fetches user's dynamic feed with caching
func (c *Client) FetchDynamic(uid string) ([]byte, int, error) {
	// Check cache first
	if data, ok := c.cache.GetDynamic(uid); ok {
		return data, http.StatusOK, nil
	}

	// Prepare request
	params := url.Values{}
	params.Set("host_mid", uid)
	params.Set("platform", "web")
	params.Set("web_location", "0.0")
	params.Set("dm_img_list", "[]")
	params.Set("dm_img_str", "V2ViR0wgMS4wIChPcGVuR0wgRVMgMi4wIENocm9taXVtKQ")
	params.Set("dm_cover_img_str", "QU5HTEUgKEFNRCwgQU1EIFJhZGVvbiA3ODBNIEdyYXBoaWNzICgweDAwMDAxNUJGKSBEaXJlY3QzRDExIHZzXzVfMCBwc181XzAsIEQzRDExKUdvb2dsZSBJbmMuIChBTU")
	params.Set("features", "itemOpusStyle,listOnlyfans,opusBigCover,onlyfansVote,forwardListHidden,decorationCard,commentsNewVersion,onlyfansAssetsV2,ugcDelete,onlyfansQaCard,avatarAutoTheme,sunflowerStyle,cardsEnhance,eva3CardOpus,eva3CardVideo,eva3CardComment,eva3CardUser")

	signedQuery, err := c.signWbi(params)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("WBI Sign Error: %v", err)
	}

	targetUrl := "https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/space?" + signedQuery

	req, err := http.NewRequest("GET", targetUrl, nil)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("Request Creation Error: %v", err)
	}

	// Set Headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://space.bilibili.com/"+uid+"/dynamic")
	req.Header.Set("Origin", "https://space.bilibili.com")
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("Accept-Language", "zh-CN,zh;q=0.9,en;q=0.8")

	// Add Cookies
	if c.sessData != "" {
		req.AddCookie(&http.Cookie{Name: "SESSDATA", Value: c.sessData})
	}
	if c.cookieString != "" {
		req.Header.Set("Cookie", c.cookieString)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, http.StatusBadGateway, fmt.Errorf("Bilibili API Error: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, http.StatusInternalServerError, fmt.Errorf("Failed to read response")
	}

	// Cache success response
	if resp.StatusCode == http.StatusOK {
		var check map[string]interface{}
		if err := json.Unmarshal(body, &check); err == nil {
			if code, ok := check["code"].(float64); ok && code == 0 {
				c.cache.SetDynamic(uid, body)
			}
		}
	}

	return body, resp.StatusCode, nil
}

// FetchImage fetches an image with caching
func (c *Client) FetchImage(imageUrl string) ([]byte, string, int, error) {
	// Check cache first
	if data, contentType, ok := c.cache.GetImage(imageUrl); ok {
		return data, contentType, http.StatusOK, nil
	}

	req, err := http.NewRequest("GET", imageUrl, nil)
	if err != nil {
		return nil, "", http.StatusBadRequest, fmt.Errorf("Invalid URL")
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Referer", "https://www.bilibili.com/")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", http.StatusBadGateway, fmt.Errorf("Failed to fetch image")
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", http.StatusInternalServerError, fmt.Errorf("Failed to read image")
	}

	contentType := resp.Header.Get("Content-Type")

	// Cache success response
	if resp.StatusCode == http.StatusOK {
		c.cache.SetImage(imageUrl, data, contentType)
	}

	return data, contentType, resp.StatusCode, nil
}
