# Playwright Automation Skill

You are an expert in Playwright browser automation with comprehensive knowledge of its API, best practices, and common patterns.

## Core Playwright Concepts

### 1. Browser Context & Pages

**Context Isolation:**
- Each context is like an incognito session
- Separate cookies, localStorage, sessions
- Use for parallel test isolation

**Page Management:**
```python
# Launch browser
browser = await playwright.chromium.launch(headless=False)

# Create context with options
context = await browser.new_context(
    viewport={'width': 1920, 'height': 1080},
    user_agent='Custom UA',
    locale='zh-CN'
)

# Create page
page = await context.new_page()
```

### 2. Locator Strategies (Priority Order)

**Best Practices:**

1. **Role Locators** (most reliable)
   ```python
   page.get_by_role("button", name="Submit")
   page.get_by_role("textbox", name="Email")
   page.get_by_role("link", name="Home")
   ```

2. **Text Locators**
   ```python
   page.get_by_text("Welcome back")
   page.get_by_text("Login", exact=True)
   ```

3. **Test ID Locators**
   ```python
   page.get_by_test_id("login-button")
   page.locator("[data-testid='submit']")
   ```

4. **CSS/XPath** (fallback)
   ```python
   page.locator("css=.modal >> button.primary")
   page.locator("xpath=//div[@class='form']//input")
   ```

### 3. Wait Strategies

**Auto-Waiting:**
Playwright auto-waits for:
- Element visible
- Element stable (not animating)
- Element enabled
- Element attached to DOM

**Explicit Waits:**
```python
# Wait for specific condition
await page.wait_for_selector("#loaded", state="visible")
await page.wait_for_load_state("networkidle")
await page.wait_for_url("**/dashboard")

# Wait for function
await page.wait_for_function("document.querySelector('.data').innerText.length > 0")

# Wait with timeout
await locator.wait_for(timeout=10000)
```

### 4. Common Actions

**Navigation:**
```python
await page.goto("https://example.com")
await page.go_back()
await page.reload()
```

**Input:**
```python
await page.fill("#email", "user@test.com")
await page.type("#search", "query", delay=100)  # Simulate typing
await page.press("#input", "Enter")
```

**Click:**
```python
await page.click("button#submit")
await page.dblclick(".item")
await page.click("text=More", force=True)  # Skip visibility check
```

**Select:**
```python
await page.select_option("select#country", "CN")
await page.select_option("select", label="China")
```

**File Upload:**
```python
await page.set_input_files("input[type='file']", "path/to/file.pdf")
await page.set_input_files("input[type='file']", [
    "file1.pdf",
    "file2.pdf"
])
```

### 5. Assertions

```python
# Element assertions
await expect(page.locator(".title")).to_be_visible()
await expect(page.locator("#count")).to_have_text("5")
await expect(page.locator("input")).to_have_value("test")

# Page assertions
await expect(page).to_have_url("**/success")
await expect(page).to_have_title("Dashboard")

# Multiple elements
await expect(page.locator("li.item")).to_have_count(10)
```

### 6. Handling Dynamic Content

**Frames:**
```python
frame = page.frame_locator("#iframe")
await frame.locator("button").click()
```

**Popups/Dialogs:**
```python
# Handle dialog
page.on("dialog", lambda dialog: dialog.accept())

# Wait for popup
async with page.expect_popup() as popup_info:
    await page.click("a[target='_blank']")
popup = await popup_info.value
```

**Downloads:**
```python
async with page.expect_download() as download_info:
    await page.click("#download-btn")
download = await download_info.value
await download.save_as("./downloads/file.pdf")
```

### 7. Screenshots & Videos

```python
# Full page screenshot
await page.screenshot(path="full.png", full_page=True)

# Element screenshot
await page.locator(".chart").screenshot(path="chart.png")

# Record video
context = await browser.new_context(
    record_video_dir="./videos/",
    record_video_size={"width": 1280, "height": 720}
)
```

### 8. Network Interception

```python
# Mock API response
await page.route("**/api/users", lambda route: route.fulfill(
    status=200,
    body='[{"id": 1, "name": "Test"}]'
))

# Wait for specific request
async with page.expect_request("**/api/data") as request_info:
    await page.click("#load-data")
request = await request_info.value

# Wait for response
async with page.expect_response("**/api/data") as response_info:
    await page.click("#load-data")
response = await response_info.value
data = await response.json()
```

### 9. Error Recovery

**Retry Pattern:**
```python
async def retry_action(action, max_attempts=3):
    for attempt in range(max_attempts):
        try:
            await action()
            return True
        except Exception as e:
            if attempt == max_attempts - 1:
                raise
            await asyncio.sleep(1)
```

**Screenshot on Failure:**
```python
try:
    await page.click("#submit")
except Exception as e:
    await page.screenshot(path=f"error_{timestamp}.png")
    raise
```

### 10. Best Practices Checklist

- [ ] Use role/text locators over CSS when possible
- [ ] Set reasonable timeouts (not too short, not too long)
- [ ] Isolate tests with fresh contexts
- [ ] Clean up resources (close browsers)
- [ ] Use network mocking for flaky APIs
- [ ] Take screenshots at key points
- [ ] Log actions for debugging
- [ ] Handle SPA navigation explicitly
- [ ] Check element visibility before click
- [ ] Use `force=True` sparingly

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Timeout waiting for selector | Slow load, wrong selector | Increase timeout, verify selector |
| Click intercepted | Overlay, tooltip | Wait for overlay gone, use force |
| Element not stable | Animation | Wait for animation, disable CSS animations |
| Navigation incomplete | Slow network | Use networkidle, increase timeout |
| Stale element reference | DOM changed | Re-query element, use locator |
| File upload fails | Hidden input | Use set_input_files, not click |
