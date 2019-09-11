# wdio-html-format-reporter
This is a heavily modified fork of the wdio-html-format-reporter, which allows webdriver.io to generate a HTML report.
Based off the excellent [wdio-spec-reporter](https://www.npmjs.com/package/wdio-spec-reporter)

## Installation

The easiest way is to keep the `wdio-html-format-reporter` as a devDependency in your package.json:

```javascript
{
  "devDependencies": {
    "wdio-html-format-reporter": "git+ssh://git@bitbucket.corporate.t-mobile.com/dig/ui-automation-html-reporter.git"
  }
}
```

Or, you can simply do it with:

```
npm install git+ssh://git@bitbucket.corporate.t-mobile.com/dig/ui-automation-html-reporter.git --save-dev
```


## Configuration
The following code shows the default wdio test runner configuration. Just add 'html-format' as another reporter to the array:

```javascript
// wdio.conf.js
module.exports = {
  // ...
  reporters: ['spec', 'html-format'],
  reporterOptions: {
    htmlFormat: {
      outputDir: './reports/',
      // optionally it can also have a custom report name that can be dynamically passed into this field.
      reportName: 'the-report-name'
    },
  },
  screenshotPath: `./screenShots`,
  // ...
};
```

## Events

### Screenshot

```javascript
browser.saveScreenshot(`${browser.options.screenshotPath}/screenshot-example.png`)

// OR //

process.send({
    event: 'screenshot:fullpage',
    filename: `${filepath}.png`
})
```

### Log messages

This will log messages to that step/test

```javascript
process.send({
  event: 'runner:logit',
  output: 'Do. Or do not. There is no try'
})

// OR //

process.send({
  event: 'runner:logit',
  output: 'great plugin for fullscreen screenshots: https://www.npmjs.com/package/wdio-screenshot'
})
```

### Log accounts

This will log the accounts to that JSON object

```javascript
process.send({
  event: 'runner:logAccounts',
  accounts: {
    "originatingUser": {
      "email": "testing080@pizzacompany.biz",
      "password": "hCNTSwrv8bxJ",
      "accountType": "t-mobile",
      "securityAnswer": "wyUXcLSxs3xs",
      "displayName": "User Name080",
      "workLine": "",
      "extension": "9080",
      "cwl": "12063340557",
      "username": "testing080@pizzacompany.biz"
    },
    "receivingUser1": {
      "email": "testing026@pizzacompany.biz",
      "password": "hCNTSwrv8bxJ",
      "accountType": "t-mobile",
      "securityAnswer": "wyUXcLSxs3xs",
      "displayName": "User Name026",
      "workLine": "14254996423",
      "extension": "9026",
      "cwl": "",
      "username": "testing026@pizzacompany.biz"
    },
    "receivingUser2": null,
    "receivingUser3": null
  }
});
```

### Log Suite Number

This will add how long it took to login to the login time table

```javascript
process.send({
  event: 'runner:logtime',
  output: {
    logTime: "FAILED",
    color: "#FFCDD2",
    suiteNumber: 42,
    browserName: `firstBrowser`
  }
});
```

### Log Login Time

This will log the accounts to that JSON object

```javascript
process.send({
  event: 'runner:logAccounts',
  suiteNumber: 42
});
```

## Example test
```javascript
const assert = require('chai').assert
const fs = require('fs-extra')
const dateFormat = require('dateFormat')

describe('some example tests for a readme.md demo', () => {
  describe('should be a passing test', () => {
    it('check the package still exists on npm', () => {
      browser.url("https://www.npmjs.com/package/wdio-html-format-reporter")
      const expectedTitle = 'wdio-html-format-reporter'
      assert.equal(browser.element('.package-name').getText(), expectedTitle, `The page title doesn't equal ${expectedTitle}`)
    })

    it('should have an installation section', () => {
      assert.isOk(browser.element('#user-content-installation').isVisible())
    })

    it('should display an imbedded screenshot that I can zoom in on', () => {
      browser.saveScreenshot(`${browser.options.screenshotPath}/screenshot-example.png`)
    })

    it('should display some output I want to log on the report', () => {
      // runner:logit is a custom event listener
      // It will you to output plain text to the HTML report
      process.send({
        event: 'runner:logit',
        output: 'Do. Or do not. There is no try'
      })
    })
  })

  describe('should have a failing test', () => {
    it('should have an configuration section', () => {
      assert.isOk(browser.element('#user-content-configuration').isVisible())
    })

    it('keywords should include "html"', () => {
      assert.match(browser.element('//h3[text()="Keywords"]/following-sibling::p[contains(@class, "list-of-links")]').getText(), /html/, '"html" is not one of the keywords')
    })

    it('keywords should include "spec"', () => {
      assert.match(browser.element('//h3[text()="Keywords"]/following-sibling::p[contains(@class, "list-of-links")]').getText(), /spec/, '"spec" is not one of the keywords')
    })

    it('keywords should include "wdio"', () => {
      assert.match(browser.element('//h3[text()="Keywords"]/following-sibling::p[contains(@class, "list-of-links")]').getText(), /wdio/, '"wdio" is not one of the keywords')
    })
  })
})

describe('Full page screenshot', () => {
  it('should open wateraid.org', () => {
    browser.url('https://www.wateraid.org/')
  })

  it('should take full page screenshot using wdio-screenshot', () => {
    // runner:logit is a custom event listener
    // It will you to output plain text to the HTML report
    process.send({
      event: 'runner:logit',
      output: 'great plugin for fullscreen screenshots: https://www.npmjs.com/package/wdio-screenshot'
    })

    const timestamp = dateFormat(new Date(), "yyyymmddHHMMss");
    const filepath = `${browser.options.screenshotPath}/${browser.session().sessionId}/${timestamp}`

    // using wdio-screenshot
    browser.saveDocumentScreenshot(`${filepath}.png`);

    // screenshot:fullpage is a custom event listener
    // It prevents having to take a normal screenshot in order to trigger runner:screenshot
    // then taking a second fullpage screenshot and overwriting the file
    process.send({
      event: 'screenshot:fullpage',
      filename: `${filepath}.png`
    })
  })
})

```

[Report Example: wdio-report.html](https://cdn.rawgit.com/aruiz-caritsqa/wdio-html-format-reporter/master/wdio-report.html)

![Report Screenshot](wdio-report.jpg)


## Output
The default output is to `./wdio-report.html`

## TODO:
- ~~Make the output file configurable~~
- ~~Convert images to JPG before embedding~~
- Better filtering options
- Reduce height of suite headers
- Make sure it works with Jasmine tests
- Pie chart?
