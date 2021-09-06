const axios = require('axios');
const idx = require('idx');

const getObject = (lhr) => {
  if(Array.isArray(lhr[0])){
    return lhr[0][0]
  }else{
    return lhr[0]
  }
}
/**
 * removes domain from url and returns rest on the right side
 * @function
 * @param {Object} core - core
 * @param {string} url - URL
 * @return {string} rest of the path
 */
const stripDomain = (url) => '/' + url.split('/').splice(3,10).join('/');

const removeLastSlash = (url) => url.replace(/\/$/, "");
/**
 * Gets Project Id from the lighthouse server
 * @function
 * @param {Object} core - core
 * @param {string} url - URL to send request.
 * @return {string} project id
 */
const getProjectID = async function getProjectID(core, url) {
  return await axios.get(removeLastSlash(url)).then(function (response) {
    return response.data[0].id
  }).catch(function (error) {
    core.info('error fetching project id', error);
    throw new Error(error)
  })
};

/**
 * Gets all the URLs on which Lighthouse was conducted
 * @function
 * @param {Object} core - core
 * @param {string} url - URL to send request.
 * @return {Object} 
 */
const getURLsToTest = async function(core, url) {
  return await axios.get(url).then(function (response) {
    return response.data
  }).catch(function (error) {
    core.info('error fetching project id', error);
    throw new Error(error)
  })
};

/**
 * Gets Information about base branch
 * @function
 * @param {Object} core - core
 * @param {Object} options - URL to send request.
 * @return {Object} 
 */
const getBaseBranchInfo = async function getBaseBranchInfo(core ,options){
  const { url, params } = options;
  return await axios.get(url, { params }).then(function (response) {
    if(response.data.length > 0) return response.data[0];
    throw new Error('No build available from base branch');
  }).catch(function (error) {
    core.info('error fetching Base branch info');
    throw new Error(error)
  })
}

/**
 * Gets Information about branch from which pull request is created
 * @function
 * @param {Object} core - core
 * @param {Object} options - URL to send request.
 * @param {string} commitHash - hash of the commit from which lh report was generated.
 * @return {Object} 
 */
const getPRBranchInfo = async function getPRBranchInfo(core ,options, commitHash) {
  const { url, params } = options;
  return await axios.get(url, { params }).then(function (response) {
    const selectedBuild = response.data.find(build => { 
      const splitMessage = build.commitMessage.split(' ')
      if(splitMessage[1] === commitHash){
        return true
      }
      return false
    });
    core.info('selectedBuild', selectedBuild)
    return selectedBuild
  }).catch(function (error) {
    core.info('error fetching PR branch info');
    throw new Error(error)
  })
}

/**
 * Gets lighthouse report for base and pull request
 * @function
 * @param {Object} core - core
 * @param {string} projectURL - URL to send request.
 * @param {Object} baseBranchInfo - information about the base branch.
 * @param {Object} prBranchInfo - information about the pull request.
 * @param {Array} collectURLList - List of urls.
 * @return {Array} - Array of lh reports 
 */
const getReportData = async function(core ,projectURL, baseBranchInfo, prBranchInfo, collectURLList) {
  const baseURL = projectURL.replace('$$buildId$$', baseBranchInfo.id);
  const prURL = projectURL.replace('$$buildId$$', prBranchInfo.id);
  const baseAxios = axios.get(baseURL);
  const PRAxios = axios.get(prURL);
  
  return await axios.all([ baseAxios, PRAxios ]).then(axios.spread((...responses) => {
    const baseResponse = responses[0]
    const prResponse = responses[1]
    const baseLHRData = collectURLList.map(item => {
      const selectedLHReport = baseResponse.data.find(base => base.url === item.url);
      return {
        url: selectedLHReport.url,
        lhr: JSON.parse(selectedLHReport.lhr),
        branch: baseBranchInfo.branch
      }
    })
    const prLHRData = collectURLList.map(item => {
      const selectedLHReport = prResponse.data.find(base => base.url === item.url);
      return {
        url: selectedLHReport.url,
        lhr: JSON.parse(selectedLHReport.lhr),
        branch: prBranchInfo.branch
      }
    })
    return [ baseLHRData, prLHRData ];

  })).catch(function (error) {
    core.info('error getting lighthouse data');
    throw new Error(error)
  })

}

/**
 * Takes lhr data of two branches and prepares a table
 * @function
 * @param {Array} lhr - github actions core 
 * @return {string} markdown table comparing two branches in multiple urls
 */

function _generateLogString(rows, timings, urls) {
  let logString = `[Lighthouse](https://developers.google.com/web/tools/lighthouse/) report for the changes in this PR: \n `;

  if(urls.length <= 1) {
  logString += `
  | Category | Base Branch (score) | PR (score) |
  | ------------- | ------------- | ------------- |
  ${rows}
  | Measure | Base Branch (timing) | PR (timing) |
  | ------------- | ------------- | ------------- |
  ${timings}`

  }else{
    let rowString = '',rowLines = '', timeString = '', timeLines = '';

    urls.forEach((url, i) => {
      let urlPath = stripDomain(url)
      if(i === 0 ){
        rowString = `| Category |`;  rowLines = `| ------- |`;
        timeString = ` \n | Measure |`; timeLines = `| ------- |`;
      }
      rowString += ` Base Branch (score) <br /> ${urlPath} | PR (score) <br /> ${urlPath} |`;
      rowLines += `------- | ------- |`;
      timeString += ` Base Branch (timing) <br /> ${urlPath} | PR (timing) <br /> ${urlPath} |`;
      timeLines += `------- | ------- |`;
      if(i === urls.length - 1){
        rowString += ` \n `; rowLines += ` \n `;
        timeString += ` \n `; timeLines += ` \n `;
      }
    })
    
    logString += `${rowString} ${rowLines} ${rows}  ${timeString} ${timeLines} ${timings} ` 
  }
  return logString;
}

/**
 * Takes lhr data of two branches and prepares a table
 * @function
 * @param {Array} lhr - lighthouse data
 * @return {string} 
 */
const parseLighthouseResultsToString = function parseLighthouseResultsToString(lhr) {
  let rows = '';
  let timings = '';
  let urls = lhr[0].map(l => l.url)
  Object.values(getObject(lhr).lhr.categories).forEach(cat => {
    const categoryName = cat.id
    // | title | base[url1] | pr[url1] |base[url2]| pr[url2] |\n
    urls.forEach((url, i) => {
      let baseItem = lhr[0].find(lhrInfo => lhrInfo.url === url)
      let prItem = lhr[1].find(lhrInfo => lhrInfo.url === url)
      
      if(i === 0) rows += `| ${ cat.title} |`;
      rows += ` ${baseItem.lhr.categories[categoryName].score * 100} | ${prItem.lhr.categories[categoryName].score * 100} | `;
      if(i === urls.length - 1) rows += ` \n `;
    })
  });

  const userDefinedCategories =  [
    'first-contentful-paint',
    'interactive',
    'first-meaningful-paint',
    'max-potential-fid',
    'total-blocking-time',
    'speed-index',
    'largest-contentful-paint',
    'cumulative-layout-shift',
  ]
  
  // | title | base[url1] | pr[url1] |base[url2]| pr[url2] |\n
  userDefinedCategories.forEach(categoryName => {

    const isAuditCategoryPresent = getObject(lhr).lhr.audits[categoryName]
    if(isAuditCategoryPresent){

      urls.forEach((url, i) => {
        let baseItem = lhr[0].find(lhrInfo => lhrInfo.url === url)
        let prItem = lhr[1].find(lhrInfo => lhrInfo.url === url)
        
        if(i === 0) timings += `| ${ isAuditCategoryPresent.title} |`;
        timings += ` ${baseItem.lhr.audits[categoryName].displayValue} | ${prItem.lhr.audits[categoryName].displayValue} | `;
        if(i === urls.length - 1) timings += ` \n `;
      })
    }

  });
  return _generateLogString(
    rows,
    timings,
    urls
  );
}

/**
 * compare two lighthouse report data and make comment the results in table
 * @function
 * @param {Object} core - github actions core 
 * @param {Array} lhr - light house report data of two branches, base and new
 * @param {Object} github - github context.
 * @param {string} secret - github token that has permission to add comment.
 * @return {Object} 
 */
const prepareAndPostComment = async function prepareAndPostComment(core, lhr, github, githubToken) {
  const mdReport = parseLighthouseResultsToString(lhr);
  core.debug("github context", github);
  core.debug("github context", github.context.payload.pull_request);
  console.log('github ------ >', github)
  if (idx(github, _ => _.context.payload.pull_request.comments_url)) { 
    throw new Error('Missing comments_url in github contexts')
  }

  const comment = await axios(github.context.payload.pull_request.comments_url, {
    method: 'post',
    data: JSON.stringify({ body: mdReport}),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${githubToken}`,
    },
  }).then(function (response){
    return response.data
  }).catch(function (error){
    core.info('Error when commenting');
    throw new Error(error)
  });
  return comment
}

module.exports = {
  getProjectID,
  getURLsToTest,
  getBaseBranchInfo,
  prepareAndPostComment,
  getReportData,
  getPRBranchInfo
};
