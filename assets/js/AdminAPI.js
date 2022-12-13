import axios from 'axios';
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';
const SCORE_API_URL = appConfig.score_api_url || 'http://localhost:8000/score';
const LOGOUT_URL = appConfig.logout_url || 'http://localhost:8000/accounts/logout/';
const INACTIVITY_TIMEOUT = appConfig.inactivity_timeout || null;

axios.defaults.xsrfHeaderName = "X-CSRFToken"
axios.defaults.xsrfCookieName = 'csrftoken'


export default class AdminAPI{

    constructor(){}

    getInactivityTimer() {
	if (INACTIVITY_TIMEOUT) {
	    /* convert seconds to milliseconds */
	    return parseInt(INACTIVITY_TIMEOUT)*1000;
	}
	return null;
    }
    
    logoutUser() {
	const data = {}
	return axios.post(LOGOUT_URL, data).then(response => response.data);
    }

    getPendingUsers() {
	const url = `${API_URL}/api/manage/users/pending/`;
        return axios.get(url).then(response => response.data);
    }
    

    submitReport(data) {
	const url = `${API_URL}/api/report/`;
	return axios.post(url, data, {
	    headers: {
		'Content-Type': 'multipart/form-data'
	    }}).then(response=>response.data);
    }

    editReport(c, data) {
	const url = `${API_URL}/api/case/${c}/report/edit/`;
        return axios.post(url, data, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }}).then(response=>response.data);
    }

    
    getCWEs(query=null) {
	let url = `${API_URL}/api/cwe/`;
	if (query) {
	    url = `${url}?${query}`;
	}
	return axios.get(url).then(response=>response.data);
    }

    getNextCWEs(url) {
	return axios.get(url).then(response=>response.data);
    }

    getEmailBounces() {
        const url = `${API_URL}/api/manage/bounce/`;
        return axios.get(url).then(response => response.data);
    }

    getAllEmailBounces() {
	const url = `${API_URL}/api/manage/bounce/?complete=1`;
        return axios.get(url).then(response => response.data);
    }

    getRecentBounces() {
	const url = `${API_URL}/api/manage/bounce/?recent=1`;
        return axios.get(url).then(response => response.data);
    }

    getBounces(url) {
        return axios.get(url).then(response => response.data);
    }

    ignoreBounce(id) {
	const data = {'action': 'ignore'};
	const url = `${API_URL}/api/manage/bounce/${id}/`;
	return axios.patch(url, data).then(response => response.data);
    }

    approvePendingUser(user) {
	let  data = {'pending': false};
	const url = `${API_URL}/api/manage/users/pending/${user.uuid}/`;
        return axios.patch(url, data).then(response => response.data);
    }

    getResolutionOptions() {
	const url = `${API_URL}/api/manage/case/options/resolutions/`;
        return axios.get(url).then(response => response.data);
    }

    addResolutionOption(data) {
	const url = `${API_URL}/api/manage/case/options/resolutions/`;
	return axios.post(url, data).then(response => response.data);
    }

    deleteResolutionOption(c) {
	const url = `${API_URL}/api/manage/case/options/resolution/${c}/`;
	return axios.delete(url).then(response => response.data);
    }
    
    getNewUsers() {
	const url = `${API_URL}/api/manage/users/new/`;
        return axios.get(url).then(response => response.data);
    }
    
    getAssignments() {
        const url = `${API_URL}/api/manage/autoassignment/`;
        return axios.get(url).then(response => response.data);
    }

    addAssignment(role, data) {
	const url = `${API_URL}/api/manage/autoassignment/${role}/`;
	return axios.patch(url, data).then(response => response.data);
    }

    removeAssignment(role, data) {
	const url = `${API_URL}/api/manage/autoassignment/${role}/`;
	return axios.patch(url, data).then(response => response.data);
    }

    addRole(data) {
	const url = `${API_URL}/api/manage/autoassignment/`;
	return axios.post(url, data).then(response => response.data);
    }

    editRole(role, data) {
	const url = `${API_URL}/api/manage/autoassignment/${role}/`;
        return axios.patch(url, data).then(response => response.data);
    }

    removeRole(c) {
    	const url = `${API_URL}/api/manage/autoassignment/${c}/`;
	return axios.delete(url).then(response => response.data);
    }

    deleteCVEAccount(c) {
	const url = `${API_URL}/api/manage/cve/account/${c}/`;
        return axios.delete(url).then(response => response.data);
    }

    addCVEAccount(data) {
	const url = `${API_URL}/api/manage/cve/account/`;
        return axios.post(url, data).then(response => response.data);
    }
    
    getCVEAccounts() {
	const url = `${API_URL}/api/manage/cve/account/`;
	return axios.get(url).then(response => response.data);
    }

    getCVEAPIOptions() {
	const url = `${API_URL}/api/manage/cve/account/`;
        return axios.options(url).then(response => response.data);
    }

    addCVEReservation(data) {
	const url = `${API_URL}/api/manage/cve/reserve/`;
	return axios.post(url, data).then(response=>response.data);
    }

    getCVEReservations(account=null) {
	let url = `${API_URL}/api/manage/cve/reserve/`;
	if (account) {
	    url = `${url}?account__id=${account}`;
	}
	return axios.get(url).then(response=>response.data);
    }	

    getActiveCVEAccounts() {
	const url = `${API_URL}/api/manage/cve/account/?active=true`;
	return axios.get(url)
    }
   

    getCVEAccount(c) {
	const url = `${API_URL}/api/manage/cve/account/${c}/`;
	return axios.get(url).then(response => response.data);
    }

    updateCVEAccount(c, data) {
	const url = `${API_URL}/api/manage/cve/account/${c}/`;
        return axios.patch(url, data).then(response => response.data).catch(function(error) {
	    console.log(error.response.data);
	});
    }

    getCaseEmailTemplates() {
	const url = `${API_URL}/api/manage/email/templates/?template_type=0`;
	return axios.get(url).then(response => response.data);
    }

    getNotifyEmailTemplates() {
	const url = `${API_URL}/api/manage/email/templates/?template_type=0&search=notify`;
	return axios.get(url).then(response => response.data);
    }

    getConnections() {
	const url = `${API_URL}/api/manage/connections/`;
        return axios.get(url).then(response => response.data);
    }

    
    getAllConnections() {
	const url = `${API_URL}/api/manage/connections/?all=1`;
        return axios.get(url).then(response => response.data);
    }

    addConnection(data) {
        const url = `${API_URL}/api/manage/connections/`;
	return axios.post(url, data).then(response => response.data);
    }

    updateConnection(c, data) {
	const url = `${API_URL}/api/manage/connection/${c}/`;
        return axios.patch(url, data).then(response => response.data);
    }

    deleteConnection(c) {
	const url = `${API_URL}/api/manage/connection/${c}/`;
	return axios.delete(url).then(response => response.data);
    }

    transferReport(d, key, form) {
	const url = `${d}/cvdp/api/transfers/report/`;
	console.log(url);
	console.log(key);
	return axios.post(url, form, {
	    headers: {                                                                                               
                'content-type': 'application/json',                                                                   
                'Authorization': `Token ${key}`,
	    }}).then(response=>response.data);
    }

    transferThread(c, d, key, form) {
	const url = `${d}/cvdp/api/transfers/case/${c}/thread/`;
	let posts = [];
	for (let i=0; i < form.length; i++) {
	    let replies = [];
	    if (form[i]['replies']) {
		let reply_arr = form[i]['replies'];
		console.log(`reply_arr ${reply_arr}`);
		for (let r=0; r<reply_arr.length; r++) {
		    if (reply_arr[r]["group"]) {
			replies.push({'content': reply_arr[r]['content'], 'author': `${reply_arr[r]["author_role"]} from group ${reply_arr[r]["group"]["name"]}`, 'created': reply_arr[r]['created']})
		    } else {
			replies.push({'content': reply_arr[r]['content'], 'author': `${reply_arr[r]["author_role"]}`, 'created': reply_arr[r]['created']})
		    }
		}
	    }
	    let author = `${form[i]["author_role"]}`
	    if (form[i].group) {
		author = `${author} from group ${form[i].group.name}`;
	    }
		
	    posts.push({'content': form[i]['content'], 'author': author, 'created': form[i]['created'], 'replies': replies})
	}
	let data = {'posts': posts};
	return axios.post(url, data, {
	    headers: {
		'content-type': 'application/json',
		'Authorization': `Token ${key}`,
	    }}).then(response=>response.data);
    }
		    

    transferVuls(c, d, key, form) {
	const url = `${d}/cvdp/api/transfers/case/${c}/vuls/`;
        console.log(url);
        console.log(key);
        return axios.post(url, form, {
            headers: {
		'content-type': 'application/json',
                'Authorization': `Token ${key}`,
            }}).then(response=>response.data);
    }

    transferAdvisory(c, d, key, form) {
	const url = `${d}/cvdp/api/transfers/case/${c}/advisory/`;
        return axios.post(url, form, {
            headers: {
                'content-type': 'application/json',
                'Authorization': `Token ${key}`,
            }}).then(response=>response.data);
    }
    
    async transferArtifact(c, d, key, filename, mime_type, get_url) {

	/* first get url */
	const {data: blob} = await axios.get(get_url, {responseType: 'arraybuffer'});
	const url = `${d}/cvdp/api/transfers/case/${c}/artifacts/`;
	console.log(url);
	console.log(key);
	//console.log(data.length);
	let formData = new FormData();
	let file = new File([blob], filename);
	//let file = new Blob([blob]);
	console.log(file.size);
	formData.append('file', file, filename);
	return axios.post(url, formData, {
	    headers: {
		'content-type': 'multipart/form-data',
		'Authorization': `Token ${key}`,
	    }}).then(response=>response.data);
    }

    transferAllArtifacts(array) {
	return axios.all(array);
    }


    async transferVexStatus(c, d, key, vul) {

	/* first get vex */
	let get_url = `${API_URL}/api/vul/${vul.id}/vex/`;
	const data = await axios.get(get_url);
	const url = `${d}/cvdp/api/transfers/case/${c}/status/`;
	let formData = {'vex': data.data}
	//formData.append('vex', JSON.stringify(data.data))
	return axios.post(url, formData, {
	    headers: {
		'content-type': 'application/json',
                'Authorization': `Token ${key}`,
            }}).then(response=>response.data);
    }
	
    
    transferAllStatus(array) {
	return axios.all(array);
    }
    
    transferCase(form) {
	const url = `${API_URL}/api/case/transfers/`;
	return axios.post(url, form).then(response=>response.data);
    }

    getTransfers(c, page) {
	const url = `${API_URL}/api/case/${c}/transfers/?page=${page}`;
        return axios.get(url).then(response=>response.data);
    }

    getTags(query=null) {
	let url = `${API_URL}/api/manage/tags/`;
	if (query) {
	    url = `${API_URL}/api/manage/tags/${query}`;
	}
        return axios.get(url).then(response=>response.data);
    }

    getVulAttributes() {
	let url = `${API_URL}/api/manage/vul/attributes/`;
        return axios.get(url).then(response=>response.data);
    }

    addVulAttribute(data) {
	const url = `${API_URL}/api/manage/vul/attributes/`;
        return axios.post(url, data).then(response=>response.data);
    }

    removeVulAttribute(id) {
        const url = `${API_URL}/api/manage/vul/attributes/${id}/`;
        return axios.delete(url).then(response=>response.data);
    }
    
    addTag(data) {
	const url = `${API_URL}/api/manage/tags/`;
        return axios.post(url, data).then(response=>response.data);
    }

    removeTag(id) {
	const url = `${API_URL}/api/manage/tag/${id}/`;
        return axios.delete(url).then(response=>response.data);
    }

    getTagOptions() {
	const url = `${API_URL}/api/manage/tags/`;
        return axios.options(url).then(response => response.data);
    }

    getCSAFProfiles() {
	const url = `${API_URL}/api/manage/csaf/profiles/`;
        return axios.get(url).then(response => response.data);
    }

    getCSAFDocId(id) {
	const url = `${API_URL}/api/case/${id}/settings/csaf/assign_doc_id/`;
        return axios.get(url).then(response => response.data);
    }

    createCSAFProfile(data) {
	const url = `${API_URL}/api/manage/csaf/profiles/`;
	return axios.post(url, data).then(response => response.data);
    }

    editCSAFProfile(profile, data) {
	const url = `${API_URL}/api/manage/csaf/profiles/${profile}/`;
        return axios.patch(url, data).then(response => response.data);
    }

    deleteCSAFProfile(profile) {
        const url = `${API_URL}/api/manage/csaf/profiles/${profile}/`;
	return axios.delete(url).then(response => response.data);
    }

    getCalendarEventsUrl(data) {
	let url=`${API_URL}/api/triage/calendar/events`;
        if (data.team) {
            const c = encodeURIComponent(data.team)
            url=`${url}?team=${c}`;
        }
	return url;
    }

    createCalendarEvent(data) {
        const url = `${API_URL}/api/triage/calendar/events/`;
        return axios.post(url, data).then(response => response.data);
    }

    updateCalendarEvent(id, data) {
        const url = `${API_URL}/api/triage/calendar/events/${id}/`;
        return axios.patch(url, data).then(response => response.data);
    }
    

    removeCalendarEvent(data) {
	const url = `${API_URL}/api/triage/calendar/events/${data}/`;
        return axios.delete(url).then(response => response.data);
    }

    
    getCalendarMeta(data) {
	let url=`${API_URL}/api/triage/calendar/`;
	if (data.team) {
	    const c = encodeURIComponent(data.team)
	    url=`${url}?team=${c}`;
	}
	return axios.get(url).then(response=>response.data);
    }

    
    /* these are scoring-specific API calls */

    getVulsToScore(page) {
	let url = `${SCORE_API_URL}/api/vuls/`;
	if (page) {
	    url = page;
	}
	return axios.get(url).then(response=>response.data);
    }

    queryVuls(query, cancel) {
	let url = `${SCORE_API_URL}/api/vuls/?${query}`;
        return axios.get(url, {signal: cancel}).then(response=>response.data);
    }
    
    scoreVul(cve, form) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/score/`;
	return axios.patch(url, form).then(response=>response.data);
    }

    getVulScore(cve) {
        const url = `${SCORE_API_URL}/api/vuls/${cve}/score/`;
	return axios.get(url).then(response=>response.data);
    }

    getVul(cve) {
	let url = `${SCORE_API_URL}/api/vuls/${cve}/`;
        return axios.get(url).then(response=>response.data);
    }

    getVulScoreActivity(cve) {
	let url = `${SCORE_API_URL}/api/${cve}/activity/`;
        return axios.get(url).then(response=>response.data);
    }

    sortVuls(column, direction, urlStr, cancel) {
	let url = `${SCORE_API_URL}/api/vuls/`;
	let query = `ordering=-${column}`;
	if (direction === "none") {
	    if (urlStr) {
		url = `${SCORE_API_URL}/api/vuls/?${urlStr}`;
	    }
	} else {
	    if (direction === "ASC") {
		query = `ordering=${column}`;
	    }
	    if (urlStr) {
		url = `${SCORE_API_URL}/api/vuls/?${urlStr}&${query}`;
	    } else {
		url = `${SCORE_API_URL}/api/vuls/?${query}`;
	    }
	}
        return axios.get(url, {signal: cancel}).then(response=>response.data);
    }
    
    removeScore(cve) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/score/`;
	return axios.delete(url).then(response => response.data);
    }

    reassignVul(cve, assign) {
	const data = {'assign': assign}
        const url = `${SCORE_API_URL}/api/vuls/${cve}/`;
	return axios.patch(url, data).then(response=>response.data);
    }

    reassessVul(cve) {
        const data = {'reassess': '1'}
        const url = `${SCORE_API_URL}/api/vuls/${cve}/`;
        return axios.patch(url, data).then(response=>response.data);
    }
    
    lockVulToScore(cve) {
	const data = {'lock': '1'}
	const url = `${SCORE_API_URL}/api/vuls/${cve}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    unlockVul(cve) {
	const data = {'unlock': '1'}
        const url = `${SCORE_API_URL}/api/vuls/${cve}/`;
	return axios.patch(url, data).then(response=>response.data);
    }

    searchCPES(query) {
	
	const url = `${SCORE_API_URL}/api/cpe/?${query}`;
	return axios.get(url).then(response=>response.data);
    }

    addCPE(data) {
        const url = `${SCORE_API_URL}/api/cpes/`;
        return axios.post(url, data).then(response=>response.data);
    }
	
    getCPEs(query) {
	const url = `${SCORE_API_URL}/api/cpes/?${query}`;
	return axios.get(url).then(response=>response.data);
    }

    getNextCPEs(url) {
	return axios.get(url).then(response=>response.data);
    }


    getVulsCPE(cpe) {
	const c = encodeURIComponent(cpe)
	const url = `${SCORE_API_URL}/api/cpe/vuls/?page_size=100&cpe=${c}`;
	return axios.get(url).then(response => response.data);
    }


    getCVEChanges(cve) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/changes/`;
	return axios.get(url).then(response=>response.data);
    }

    getVulAnalysis(cve) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/analysis/`;	
	return axios.get(url).then(response=>response.data);
    }

    addAnalysis(cve, data, update=false) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/analysis/`;
	if (update) {
	    return axios.patch(url, data).then(response=>response.data);
	} else {
            return axios.post(url, data).then(response=>response.data);
	}
    }

    addADP(cve, data) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/analysis/adp/`;
        return axios.post(url, data).then(response=>response.data);
    }


    getAnalysisChangelog(cve, page=1) {
	const url = `${SCORE_API_URL}/api/vuls/${cve}/analysis/activity/?page=${page}`;
        return axios.get(url).then(response=>response.data);
    }


    createCaseFromPreVul(id) {
	const data = {'something': 'something'}
        const url = `${SCORE_API_URL}/api/predisclosure/vuls/${id}/`;
        return axios.post(url, data).then(response=>response.data);
    }
    
    
    createCaseFromVul(cve, data) {
        const url = `${SCORE_API_URL}/api/vuls/${cve}/`;
	return axios.post(url, data).then(response=>response.data);
    }

    getSSVCUsers() {
	let url = `${SCORE_API_URL}/api/users/`;
        return axios.get(url).then(response=>response.data);
    }

    getSSVCScoredByUsers() {
	const url = `${SCORE_API_URL}/api/vuls/`;
        return axios.options(url).then(response => response.data);
	/*let url = `${SCORE_API_URL}/api/users/?scored=1`;
        return axios.get(url).then(response=>response.data);*/
    }
    
    getSSVCInsights(start, end) {
	let url = `${SCORE_API_URL}/api/insights/?start=${start}&end=${end}`;
	return axios.get(url).then(response=>response.data);
    }


    getIngestStats(start, end) {
	let url = `${SCORE_API_URL}/api/insights/ingest/?start=${start}&end=${end}`;
	return axios.get(url).then(response=>response.data);
    }
	
    
    getAnalysisInsights(start, end) {
        let url = `${SCORE_API_URL}/api/insights/vulnrich/?start=${start}&end=${end}`;
        return axios.get(url).then(response=>response.data);
    }

    getAnalysisInsightsUser(start, end, user) {
        let url = `${SCORE_API_URL}/api/insights/vulnrich/?start=${start}&end=${end}&user=${user}`;
        return axios.get(url).then(response=>response.data);
    }
    
    getSSVCDecisionInsights(start, end, next_url) {
	let url = `${SCORE_API_URL}/api/insights/score/?start=${start}&end=${end}`;	
	if (next_url) {
	    url = next_url;
	}
        return axios.get(url).then(response=>response.data);
    }
    
    getSSVCInsightsUser(start, end, user) {
        let url = `${SCORE_API_URL}/api/insights/?start=${start}&end=${end}&user=${user}`;
        return axios.get(url).then(response=>response.data);
    }

    getSoftwarePriorities() {
	let url = `${SCORE_API_URL}/api/priorities/`;
        return axios.get(url).then(response=>response.data);
    }

    createSoftwarePriority(data) {
        let url = `${SCORE_API_URL}/api/priorities/`;
        return axios.post(url, data).then(response=>response.data);
    }

    deleteSoftwarePriority(id) {
	let url = `${SCORE_API_URL}/api/priorities/${id}/`;
        return axios.delete(url).then(response => response.data);
    }

    addCVEAssignment(data) {
	let url = `${SCORE_API_URL}/api/assignments/`;
        return axios.post(url, data).then(response=>response.data);
    }

    getCVEAssignments() {
	let url = `${SCORE_API_URL}/api/assignments/`;
        return axios.get(url).then(response=>response.data);
    }

    deleteCVEAssignment(id) {
        let url = `${SCORE_API_URL}/api/assignments/${id}/`;
        return axios.delete(url).then(response => response.data);
    }

    getPreVulsToScore(page) {
        let url = `${SCORE_API_URL}/api/predisclosure/vuls/`;
        if (page) {
            url = page;
        }
        return axios.get(url).then(response=>response.data);
    }

    queryPreVuls(query, cancel) {
        let url = `${SCORE_API_URL}/api/predisclosure/vuls/?${query}`;
        return axios.get(url, {signal: cancel}).then(response=>response.data);
    }

    updatePredisclosureVul(vul, data) {
	let url = `${SCORE_API_URL}/api/predisclosure/vuls/${vul}/`;
	return axios.patch(url, data).then(response=>response.data);
    }
    
    getPreVul(cve) {
        let url = `${SCORE_API_URL}/api/predisclosure/vuls/${cve}/`;
        return axios.get(url).then(response=>response.data);
    }

    sortPreVuls(column, direction, urlStr, cancel) {
        let url = `${SCORE_API_URL}/api/predisclosure/vuls/`;
	let query = `ordering=-${column}`;
        if (direction === "none") {
            if (urlStr) {
                url = `${SCORE_API_URL}/api/predisclosure/vuls/?${urlStr}`;
            }
        } else {
            if (direction === "ASC") {
                query = `ordering=${column}`;
            }
            if (urlStr) {
	        url = `${SCORE_API_URL}/api/predisclosure/vuls/?${urlStr}&${query}`;
            } else {
                url = `${SCORE_API_URL}/api/predisclosure/vuls/?${query}`;
            }
        }
	return axios.get(url, {signal: cancel}).then(response=>response.data);
    }

    updatePreVulCVSSScore(vul, cvss) {
	let url = `${SCORE_API_URL}/api/predisclosure/vuls/${vul.id}/`;
	return axios.patch(url, cvss).then(response=>response.data);
    }

    addPreVulSSVCScore(vul, ssvc) {
	let url = `${SCORE_API_URL}/api/predisclosure/vuls/${vul.id}/score/`;
	return axios.patch(url, ssvc).then(response=>response.data);
    }

    updatePreVulSSVCScore(vul, ssvc) {
	let url = `${SCORE_API_URL}/api/predisclosure/vuls/${vul.id}/score/`;
	return axios.patch(url, ssvc).then(response=>response.data);
    }


    
    
}
