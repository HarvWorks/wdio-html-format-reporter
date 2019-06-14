const crypto = require('crypto')
const events = require('events')
const Handlebars = require('handlebars')
const fs = require('fs-extra')
const _ = require('lodash');
const path = require('path')
const moment = require('moment')
const momentDurationFormatSetup = require("moment-duration-format");
momentDurationFormatSetup(moment);
const escapeStringRegexp = require('escape-string-regexp')
const Png = require("pngjs").PNG
const Jpeg = require("jpeg-js")

class HtmlReporter extends events.EventEmitter {
  constructor (baseReporter, config, options = {}) {
    super()
    this.baseReporter = baseReporter

    this.config = config
    this.errorCount = 0
    this.specs = {}
    this.results = {}
    this.baseReporter.stats.tempSuiteResults = {}
    this.baseReporter.stats.suiteResults = {}
    this.blankResults = {
      start: "",
      end: "",
      _duration: "",
      suiteResults: {
        passing: 0,
        pending: 0,
        failing: 0,
      },
      counts: {
        passes: 0,
        pending: 0,
        failures: 0
      },
      runners: {
        "0-0": {
          specs: {
            currentSpecs: {
              suites: {},
              logTimes: [],
              logTimeHeader: []
            }
          }
        }
      }
    }

    this.on('runner:start', function (runner) {
      this.specs[runner.cid] = runner.specs
      this.results[runner.cid] = {
        passing: 0,
        pending: 0,
        failing: 0
      }
      this.baseReporter.stats.tempSuiteResults = {
        passing: 0,
        pending: 0,
        failing: 0
      }
      this.baseReporter.stats.suiteResults = {
        passing: 0,
        pending: 0,
        failing: 0
      }
    })

    this.on('suite:start', function (suite) {})

    this.on('test:pending', function (test) {
      this.results[test.cid].pending++
      this.baseReporter.stats.tempSuiteResults.pending++
    })

    this.on('test:pass', function (test) {
      this.results[test.cid].passing++
      this.baseReporter.stats.tempSuiteResults.passing++
    })

    this.on('runner:screenshot', function (runner) {
      // if the filename isn't defined, it cannot find the file and cannot be added to the report
      if (!runner.filename) {
        return
      }
      const cid = runner.cid
      const stats = this.baseReporter.stats
      const results = stats.runners[cid]
      const specHash = stats.getSpecHash(runner)
      const spec = results.specs[specHash]
      const lastKey = Object.keys(spec.suites)[Object.keys(spec.suites).length-1]
      const currentTestKey = Object.keys(spec.suites[lastKey].tests)[Object.keys(spec.suites[lastKey].tests).length-1]
      spec.suites[lastKey].tests[currentTestKey].screenshots.push(runner.filename)
    })

    this.on('screenshot:fullpage', function (data) {
      // if the filename isn't defined, it cannot find the file and cannot be added to the report
      if (!data.filename) {
        return
      }
      const cid = data.cid
      const stats = this.baseReporter.stats
      const results = stats.runners[cid]
      const specHash = Object.keys(results.specs)[Object.keys(results.specs).length-1]
      const spec = results.specs[specHash]
      const lastKey = Object.keys(spec.suites)[Object.keys(spec.suites).length-1]
      const currentTestKey = Object.keys(spec.suites[lastKey].tests)[Object.keys(spec.suites[lastKey].tests).length-1]
      spec.suites[lastKey].tests[currentTestKey].screenshots.push(data.filename)
    })

    this.on('test:fail', function (test) {
        this.results[test.cid].failing++
        this.baseReporter.stats.tempSuiteResults.failing++
    })

    this.on('suite:end', function (suite) {
      const tempResults = this.baseReporter.stats.tempSuiteResults
      
      this.baseReporter.stats.tempSuiteResults = {
        passing: 0,
        pending: 0,
        failing: 0
      }
      if (tempResults.failing > 0) {
        return this.baseReporter.stats.suiteResults.failing ++
      } 
      if (tempResults.pending > 0) {
        return this.baseReporter.stats.suiteResults.pending ++
      }
      if (tempResults.passing > 0) {
        return this.baseReporter.stats.suiteResults.passing ++
      }
    })

    this.on('runner:end', function (runner) {})

    this.on('end', function () {
      const file = this.grabFile();
      let data = file.data;
      data.push(this.mergeData([this.baseReporter.stats]));
      fs.outputJsonSync(file.jsonfilePath, data)

      this.htmlOutput();
    })

    this.on('runner:logit', function (data) {
      const stats = this.baseReporter.stats
      const results = stats.runners[data.cid]
      const specHash = Object.keys(results.specs)[Object.keys(results.specs).length-1]
      const spec = results.specs[specHash]
      const lastKey = Object.keys(spec.suites)[Object.keys(spec.suites).length-1]
      const currentTestKey = Object.keys(spec.suites[lastKey].tests)[Object.keys(spec.suites[lastKey].tests).length-1]

      if (spec.suites[lastKey].tests[currentTestKey].logit == null) {
        spec.suites[lastKey].tests[currentTestKey].logit = []
      }
      spec.suites[lastKey].tests[currentTestKey].logit.push(data.output)
    })

    this.on('runner:logerror', function (data) {
      const stats = this.baseReporter.stats
      const results = stats.runners[data.cid]
      const specHash = Object.keys(results.specs)[Object.keys(results.specs).length-1]
      const spec = results.specs[specHash]
      const lastKey = Object.keys(spec.suites)[Object.keys(spec.suites).length-1]

      spec.suites[lastKey].logerror = data.output
    })

    this.on('runner:logtime', function (data) {
      const stats = this.baseReporter.stats
      const results = stats.runners[data.cid]
      const specHash = Object.keys(results.specs)[Object.keys(results.specs).length-1]
      const spec = results.specs[specHash]

      if (!spec.logTimes) {
        spec.logTimes = [];
      } 
      if (!spec.logTimeHeader) {
        spec.logTimeHeader = ["Suite"];
      } 

      const index = spec.logTimeHeader.findIndex(elem => elem === data.output.browserName);
      if (index < 0) {
        spec.logTimeHeader.push(data.output.browserName)
      }
      while(!spec.logTimes[data.output.suiteNumber - 1]) {
        spec.logTimes.push({});
      }

      spec.logTimes[data.output.suiteNumber - 1][data.output.browserName] = {
        logTime: data.output.logTime,
        color: data.output.color
      }
    })
  }

  htmlOutput() {
    let suiteCounter = 0;
    let source = fs.readFileSync(path.resolve(__dirname, '../lib/wdio-html-reporter-template.hbs'), 'utf8')

    Handlebars.registerHelper('imageAsBase64', function(screenshotFile, screenshotPath, options) {
      // occurs when there is an error file
      if (!fs.existsSync(screenshotFile)) {
        screenshotFile = `${screenshotPath}/${screenshotFile}`
      }
      let png = new Png.sync.read(fs.readFileSync(path.resolve(`${screenshotFile}`)))
      return `data:image/jpeg;base64,${Jpeg.encode(png, 50).data.toString('base64')}`
    })

    Handlebars.registerHelper('isValidSuite', function(suite, options) {
      if (suite.title.length > 0 && Object.keys(suite.tests).length > 0 && suite.uid.match(new RegExp(escapeStringRegexp(suite.title)))) {
        return options.fn(this)
      }
      return options.inverse(this)
    })

    Handlebars.registerHelper('testStateColour', function(state, options) {
      if (state === 'pass') {
        return 'test-pass'
      } else if (state === 'fail') {
        return 'test-fail'
      } else if (state === 'pending') {
        return 'test-pending'
      }
    })

    Handlebars.registerHelper('suiteStateColour', function(tests, options) {
      let validTests = _.values(tests).filter((test) => {
        return test.title;
      });

      let numTests = Object.keys(validTests).length

      let fail = _.values(tests).find((test) => {
        return test.state === 'fail'
      })
      if (fail != null) {
        return 'suite-fail'
      }

      let pending = _.values(tests).find((test) => {
        return test.state === 'pending'
      })
      if (pending != null) {
        return 'suite-pending'
      }

      let passes = _.values(tests).filter((test) => {
        return test.state === 'pass'
      })
      if (passes.length === numTests && numTests > 0) {
        return 'suite-pass'
      }
      return 'suite-unknown'
    })

    Handlebars.registerHelper('humanizeDuration', function(duration, options) {
      return moment.duration(duration, "milliseconds").format('hh:mm:ss.SS', {trim: false})
    })

    Handlebars.registerHelper('ifSuiteHasTests', function(testsHash, options) {
      if (Object.keys(testsHash).length > 0) {
        return options.fn(this)
      }
      return options.inverse(this)
    })

    Handlebars.registerHelper('suiteAddCounter', function(title, options) {
      suiteCounter ++;
      return `${suiteCounter}: ${title}`;
    });

    Handlebars.registerHelper('ifSuiteHasFailure', function(tests, options) {
      let fail = _.values(tests).find((test) => {
        return test.state === 'fail'
      })
      if (fail != null) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

    Handlebars.registerHelper('suiteStepFailure', function(tests, options) {
      let fail = _.values(tests).find((test) => {
        return test.state === 'fail'
      })
      return fail.title;
    });

    Handlebars.registerHelper('drawTableRows', function(spec, options) {
      const suiteTitles = _.values(spec.suites).filter(suite => Object.keys(suite.tests).length > 0 )
      .map(suite => {
        const length = 75;
        return suite.title.length <= length ? suite.title : `${suite.title.substr(0, length - 4)} ...`;
      });
      let result = ""

      spec.logTimes.forEach((logTimeRow, index) => {
        result = `${result}<tr>`;
        spec.logTimeHeader.forEach((browser, jndex) => {
          if (jndex === 0) {
            result = `${result}<td>${index + 1}: ${suiteTitles[index]}</td>`
          } else {
            let timeTook = '-';
            let attributes = `class="test-unknown"`
            if (logTimeRow && logTimeRow[browser] && logTimeRow[browser].logTime) {
              timeTook = logTimeRow[browser].logTime;
              attributes = `style="background-color:${logTimeRow[browser].color}"`;
            }
            result = `${result}<td ${attributes}>${timeTook}</td>`;
          }
        })
        result = `${result}</tr>`;
      })
      return result;
    });

  
    const template = Handlebars.compile(source);
    const file = this.grabFile();
    const data = {stats: this.mergeData(file.data)};
    const result = template(data);
    const reportfile = `${this.getValidPath()}.html`;

    console.log(`View WDIO HTML Report at: ${reportfile}`);
    fs.outputFileSync(reportfile, result);
  }

  grabFile() {
    let data = [];

    const jsonfilePath  = `${this.getValidPath()}.json`;

    if (fs.pathExistsSync(jsonfilePath)) {
      data = fs.readJsonSync(jsonfilePath);
    }
    return {
      data,
      jsonfilePath
    };
  }

  getValidPath() {
    let result = `./wdio-report`
    if (
      this.config.reporterOptions && 
      this.config.reporterOptions.htmlFormat && 
      this.config.reporterOptions.htmlFormat.outputDir &&
      fs.pathExistsSync(this.config.reporterOptions.htmlFormat.outputDir)
    ) {
      const tempReportName = this.config.reporterOptions.htmlFormat.reportName
      let reportName = tempReportName ? tempReportName : `wdio-report`;
      result = `${this.config.reporterOptions.htmlFormat.outputDir}/${reportName}`
    }
    return result;
  }

  mergeData( data = [] ) {
    let results;
    data.forEach( stats => {
      if (!results) {
        results = this.blankResults;
        results.start = stats.start;
      }
      // This makes sure that the very last run will overwrite the current time.
      results.end = stats.end;
      results._duration = stats._duration;

      results.suiteResults.passing += stats.suiteResults.passing;
      results.suiteResults.pending += stats.suiteResults.pending;
      results.suiteResults.failing += stats.suiteResults.failing;
      results.counts.passes += stats.counts.passes;
      results.counts.pending += stats.counts.pending;
      results.counts.failures += stats.counts.failures;

      _.values(stats.runners).forEach( runner => {
        _.values(runner.specs).forEach( spec => {
          _.values(spec.suites).forEach( suite => {
            const uuid = crypto.randomBytes(16).toString("hex");
            results.runners["0-0"].specs.currentSpecs.suites[uuid] = suite;
          })

          const currentLogTimes = results.runners["0-0"].specs.currentSpecs.logTimes;
          results.runners["0-0"].specs.currentSpecs.logTimes = currentLogTimes.concat(spec.logTimes);

          const currentLogTimeHeader = results.runners["0-0"].specs.currentSpecs.logTimeHeader
          results.runners["0-0"].specs.currentSpecs.logTimeHeader = this.mergeArrays(currentLogTimeHeader, spec.logTimeHeader);
        })
      })
    })
    return results;
  }

  mergeArrays( array1, array2 ) {
    let results = array1.concat(array2);
    for (let i = 0; i < results.length; i ++) {
      for (let j  =i + 1; j < results.length; j ++) {
          if (!results[i] || results[i] === '' || results[i] === results[j])
              results.splice(j--, 1);
      }
    }
    return results;
  }
}
module.exports = HtmlReporter
