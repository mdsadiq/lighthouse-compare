# Create a Lighthouse Compare Action

Use this action to compare lighthouse results between base branch(master/main) and triggered branch
This template


## Features
- ✅ Collect data from lhci server
- 😻 See both results compared in comments
- ⚙️ Run it on your custom server running `lighthouse-server`


## Quick Start
- Copy the token provided on the authorization confirmation page and add it to your secret `githubToken`
- Add the server url where the lhci server is running to `lhciServerURL`
- Add `baseBranch` if your default branch is not master (default branch against which your PR should be compared)
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

  [] support comparing more than one URL
  [] support comparing more than one URL