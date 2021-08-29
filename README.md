# Create a Lighthouse Compare Action

Use this action to compare lighthouse results between base branch(master/main) and triggered branch
This template


## Features
- ✅ Collect data from lhci server
- 😻 See both results compared in comments
- ⚙️ Run it on your custom server running `lighthouse-server`


## Quick Start
- Copy the token provided on the authorization confirmation page and add it to your secret `secret`
- Add the server url where the lhci server is running to `lhci-server`
- Enjoy as the it gets the results for you ! 🕵️ 


## Inputs
`token`
Provide your token
`serverURL`
Provide your server URL

## Usage

How to consume

```yaml
    uses: mdsadiq/lighthouse-compare@v1.1
    with:
      lhci-server: https://example.com
      secret: ${{ secret.LH_COMPARE_GITHUB_APP_TOKEN }}
```

## TO-DO

  - handle case when base branch with 1URL compares to 2 URLs in another branch