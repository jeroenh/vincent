import axios from 'axios';
import {format} from 'date-fns';
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';

axios.defaults.xsrfHeaderName = "X-CSRFToken"
axios.defaults.xsrfCookieName = 'csrftoken'


export default class CaseThreadAPI{

    constructor(){
    }

    getUser() {
        const url = `${API_URL}/api/user/`;
        return axios.get(url).then(response => response.data);
    }
    
    userAssociationRequest(data) {
	const url = `${API_URL}/api/group/request/`;
        return axios.post(url, data).then(response => response.data);
    }
    
    getCaseApprovals(caseid) {
	const url = `${API_URL}/api/case/${caseid}/approvals/`;
        return axios.get(url).then(response => response.data);
    }

    updateCaseApproval(id, data) {
	const url = `${API_URL}/api/case/approvals/${id}/`;
        return axios.patch(url, data).then(response => response.data);
    }
    
    requestCaseApproval(id, data) {
	const url = `${API_URL}/api/case/${id}/approvals/`;
        return axios.post(url, data).then(response => response.data);
    }

    getCaseStates() {
        const url = `${API_URL}/api/case/states/`;
        return axios.get(url).then(response => response.data);
    }
    
    getCaseMetrics(start, end) {
	const url = `${API_URL}/api/metrics/?start=${start}&end=${end}`;
	return axios.get(url).then(response => response.data);
    }

    getUserCaseMetrics(user) {
	const url = `${API_URL}/api/metrics/?user=${user}`;
        return axios.get(url).then(response => response.data);
    }

    getCaseMetadata(c=null) {
	let url = `${API_URL}/api/case/metadata/`;
	if (c) {
	    url = `${API_URL}/api/case/${c}/metadata/`;
	}
	return axios.get(url).then(response => response.data);
    }

    getUserCaseState(c) {
	const url = `${API_URL}/api/case/${c.case}/user/`;
	return axios.get(url).then(response => response.data);
    }

    getCaseNotifications() {
	const url = `${API_URL}/api/case/notifications/`;
        return axios.get(url).then(response => response.data);
    }
    
    getUserAssignments() {
	const url = `${API_URL}/api/user/assignments/`;
        return axios.get(url).then(response => response.data);
    }

    getCaseUserAssignments(c) {
	const url = `${API_URL}/api/case/${c}/user/assignments/`;
        return axios.get(url).then(response => response.data);
    }

    getCaseActivity(c) {
	const url = `${API_URL}/api/case/${c.case_id}/activity/`;
	return axios.get(url).then(response => response.data);
    }

    getMyActivity(c, search=null) {
	let url = `${API_URL}/api/case/activity/`;
	if (c) {
	    url = c;
	    if (search) {
		url = `${url}&q=${search}`;
	    }
	}
        return axios.get(url).then(response => response.data);
    }

    searchCaseActivity(c, search) {
	const url = `${API_URL}/api/case/${c.case_id}/activity/?q=${search}`;
        return axios.get(url).then(response => response.data);
    }

    unassignCase(c, data) {
	const url = `${API_URL}/api/case/${c}/unassign/`;
        let formField = new FormData();
	for (var i = 0; i < data.users.length; i++) {
            formField.append('users[]', data.users[i]);
        }
	formField.append('reason', data.reason)
        return axios.post(url, formField).then(response => response.data);
    }
    
    assignCase(c, name) {
	const url = `${API_URL}/api/case/${c}/assign/`;
	let formField = new FormData();
        formField.append('user', name);
        return axios.post(url, formField).then(response => response.data);
    }
    autoAssignCase(c, name) {
	const url = `${API_URL}/api/case/${c}/assign/`;
	let formField = new FormData();
        formField.append('role', name);
        return axios.post(url, formField).then(response => response.data);
    }

    getArchivedThreads(c) {
        const url = `${API_URL}/api/case/${c.case}/threads/archived/`;
        return axios.get(url).then(response => response.data);
    }
    
    getThreads(c) {
        const url = `${API_URL}/api/case/${c.case}/threads/`;
        return axios.get(url).then(response => response.data);
    }

    getOfficialThread(c) {
	const url = `${API_URL}/api/case/${c.case}/threads/?official=1`;
        return axios.get(url).then(response => response.data);
    }
    
    getThread(c) {
        const url = `${API_URL}/api/case/thread/${c.id}`;
        return axios.get(url).then(response => response.data);
    }
    deleteThread(c) {
        const url = `${API_URL}/api/case/thread/${c}/`;
        return axios.delete(url);
    }

    updateThread(c, data) {
        const url = `${API_URL}/api/case/thread/${c}/`;
        return axios.patch(url, data);
    }

    getPosts(c) {
        const url = `${API_URL}/api/case/thread/${c.id}/posts/`;
	return axios.get(url).then(response => response.data);
    }

    getPostsMax(c) {
	const url = `${API_URL}/api/case/thread/${c}/posts/?page_size=100`;
	return axios.get(url).then(response => response.data);
    }
    
    getPost(c) {
	const url = `${API_URL}/api/case/thread/post/${c.id}/`;
        return axios.get(url).then(response => response.data);
    }

    getPostDiff(c) {
	const url = `${API_URL}/case/thread/post/diff/${c}/`;
	return axios.get(url).then(response=>response.data);
    }
    getThreadParticipants(c) {
	const url = `${API_URL}/api/case/thread/${c}/participants/`;
	return axios.get(url).then(response=>response.data);
    }

    getCaseParticipantSummary(c) {
	const url = `${API_URL}/api/case/${c.case}/participants/summary/`;
        return axios.get(url);
    }

    getCaseReport(c) {
	const url = `${API_URL}/report/add/case/${c.case_id}/`;
        return axios.get(url);
    }

    getOriginalReport(c) {
        const url = `${API_URL}/case/${c}/report/original/`;
        return axios.get(url);
    }
    
    addCaseReport(c, data) {
	let formField = new FormData();
	for (let k in data) {
	    formField.append(k, data[k])
	}
	const url = `${API_URL}/report/case/${c.case_id}/add/`;
	return axios.post(url, formField).then(response => response.data);
    }
    
    getCaseParticipants(c) {
        const url = `${API_URL}/api/case/${c.case}/participants/`;
        return axios.get(url).then(response=>response.data);
    }

    getCaseOwners(c) {
        const url = `${API_URL}/api/case/${c.case}/participants/?role=owner`;
        return axios.get(url).then(response=>response.data);
    }

    getPinnedPosts(c) {
        const url = `${API_URL}/api/case/thread/${c.id}/posts/?pinned=1`;
        return axios.get(url).then(response => response.data);
    }

    pinPost(c) {
	const data = {'pinned': true};
	const url = `${API_URL}/api/case/thread/post/${c.id}/`;
	return axios.patch(url, data).then(response=>response.data);
    }	

    unpinPost(c) {
        const data = {'pinned': false};
        const url = `${API_URL}/api/case/thread/post/${c.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    getPostsByURL(link) {
	return axios.get(link).then(response => response.data);
    }
    deletePost(c) {
	const url = `${API_URL}/api/case/thread/post/${c}/`;
	return axios.delete(url).then(response=>response.data);
    }

    editPost(data, post) {
        const url = `${API_URL}/api/case/thread/post/${post.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    likePost(post, reaction) {
	const data = {reaction: reaction}
	const url = `${API_URL}/api/case/thread/post/${post.id}/react/`;
        return axios.post(url, data).then(response=>response.data);
    }

    addPost(data, thread) {
        const url = `${API_URL}/api/case/thread/${thread.id}/posts/`;
        return axios.post(url, data).then(response=>response.data);
    }
    
    getPostsHTML(c) {
	const url = `${API_URL}/case/thread/posts/${c.id}/`;
	return axios.get(url).then(response => response.data);
    }
    getParticipants(c) {
	const url = `${API_URL}/api/contacts/`
	return axios.get(url).then(response => response.data);
    }
    createThread(c, data) {
        const url = `${API_URL}/api/case/${c.case}/threads/`;
        return axios.post(url, data).then(response => response.data);
    }
    editCaseParticipant(c, role) {
	const data = {'role': role};
        const url = `${API_URL}/api/case/participant/${c}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    removeCaseParticipants(c) {
	const requests = c.map((item) => `${API_URL}/api/case/participant/${item}/`);
	return axios.all(requests.map((item) => axios.delete(item))).then((data) => data);
    }
	
    
    removeCaseParticipant(c) {
	let formField = new FormData();
	const url = `${API_URL}/api/case/thread/participant/${c}/`;
	return axios.delete(url).then(response=> response.data);
    }
    
    createThreadParticipants(thread, participants, role) {
	let formField = new FormData();
	const url = `${API_URL}/api/case/thread/${thread}/participants/`;
	for (var i = 0; i < participants.length; i++) {
	    formField.append('names[]', participants[i]);
	}
	formField.append('role', role);
	return axios.post(url, formField).then(response=> response.data);
    }
    createCaseParticipants(c, participants, role) {
	let formField = new FormData();
	const url = `${API_URL}/api/case/${c}/participants/`;
	for (var i = 0; i < participants.length; i++) {
	    formField.append('names[]', participants[i]);
	}
    	formField.append('role', role);
	return axios.post(url, formField).then(response=> response.data);
    }

    notifyCaseParticipants(c, data) {
	const url = `${API_URL}/case/${c.case}/participants/notify/`;
	return axios.post(url, data).then(response=> response.data);
    }

    notifyAllParticipants(c, data) {
	const url = `${API_URL}/case/${c.case}/participants/notify/all/`;
        return axios.post(url, data).then(response=> response.data);
    }

    searchThreads(c, search) {
	const url = `${API_URL}/api/case/${c}/threads/search/?search=${search}`;
	return axios.get(url).then(response=>response.data);
    }
    
    searchPosts(c, search) {
	const url = `${API_URL}/api/case/thread/${c.id}/posts/?search=${search}`;
	return axios.get(url).then(response=>response.data);
    }

    searchCases(search, cancel) {
        const url = `${API_URL}/api/cases/?${search}`;
	if (cancel) {
	    return axios.get(url, {cancelToken: cancel.token}).then(response=>response.data);
	} else {
            return axios.get(url).then(response=>response.data);
	}
    }

    getCases() {
        const url = `${API_URL}/api/cases/`;
	return axios.get(url).then(response => response.data);
    }
    
    getCase(c) {
	const url = `${API_URL}/api/cases/${c.case}/`;
        return axios.get(url).then(response => response.data);
    }

    getCasesByPage(page) {
	const url = `${API_URL}/api/cases/?page=${page}`;
        return axios.get(url).then(response => response.data);
    }


    searchAll(search, cancel) {
        const url = `${API_URL}/api/search/?${search}`;
        return axios.get(url, {cancelToken: cancel.token})
    }
    
    getMyCases(search=null) {
	let url = `${API_URL}/api/cases/?owned=True&status=0&status=1`;
	if (search) {
	    url = `${API_URL}/api/cases/?owned=True&status=0&status=1&${search}`;
	}
	return axios.get(url).then(response => response.data);
    }

    getMyCasesByPage(page) {
	const url = `${API_URL}/api/cases/?owned=True&status=0&status=1&page=${page}`;
	return axios.get(url).then(response => response.data);
    }
    
    
    updateCase(c, data) {
	const url = `${API_URL}/api/cases/${c.case_id}/`;
        return axios.patch(url, data).then(response => response.data);
    }
    
    getUnassignedCases(search=null) {
	let url = `${API_URL}/api/triage/`;
	if (search) {
            url = `${API_URL}/api/triage/?${search}`;
	}
        return axios.get(url).then(response=>response.data);
    }
    
    getTriageMeta() {
	let url = `${API_URL}/api/triage/meta/`;
	return axios.get(url).then(response=>response.data);
    }

    getUnassignedCasesByPage(page) {
	const url = `${API_URL}/api/triage/?page=${page}`;
        return axios.get(url).then(response => response.data);
    }

    getVul(c) {
        const url = `${API_URL}/api/vul/${c.id}/`;
        return axios.get(url).then(response => response.data);
    }
    
    getVuls(c) {
	const url = `${API_URL}/api/case/${c.case_id}/vuls/`;
        return axios.get(url).then(response => response.data);
    }

    deleteVulnerability(c) {
	const url = `${API_URL}/api/vul/${c}/`;
        return axios.delete(url);
    }    
    
    addVul(c, data) {
        const url = `${API_URL}/api/case/${c.case_id}/vuls/`;
	return axios.post(url, data);
    }

    updateVul(vul, data) {
        const url = `${API_URL}/api/vul/${vul.id}/`;
	return axios.patch(url, data);
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

    addArtifact(c, data) {
        const url = `${API_URL}/api/case/${c.case_id}/artifacts/`;
        return axios.post(url, data, {
	    headers: {
		'Content-Type': 'multipart/form-data'
	    }}).then(response => response.data);
    }

    getArtifacts(c) {
	const url = `${API_URL}/api/case/${c.case_id}/artifacts/`;
        return axios.get(url).then(response => response.data);
    }

    updateArtifact(c, data) {
	const url = `${API_URL}/api/case/artifact/${c.uuid}/`;
	return axios.patch(url, data);
    }

    shareCaseArtifact(c) {
	let data = {'share': true};
	const url = `${API_URL}/api/case/artifact/${c.uuid}/`;
        return axios.patch(url, data);
    }

    removeArtifact(c) {
	const url = `${API_URL}/api/case/artifact/${c}/`;
        return axios.delete(url).then(response => response.data);
    }

    addPostImage(data, thread) {
	const url = `${API_URL}/api/case/thread/${thread.id}/upload/`;
	return axios.post(url, data, {
            headers: {
	        'Content-Type': 'multipart/form-data'
            }});
    }

    getCVSSScore(vul) {
	const url = `${API_URL}/api/case/vul/${vul.id}/cvss/`;
        return axios.get(url).then(response => response.data);
    }

    addCVSSScore(vul, data) {
	const url = `${API_URL}/api/case/vul/${vul.id}/cvss/`;
        return axios.post(url, data).then(response => response.data);
    }

    updateCVSSScore(vul, data) {
	const url = `${API_URL}/api/case/vul/${vul.id}/cvss/`;
	return axios.patch(url, data).then(response => response.data);
    }

    removeCVSSScore(vul, version) {
	const url = `${API_URL}/api/case/vul/${vul.id}/cvss/v${version}/`;
        return axios.delete(url).then(response => response.data);
    }

    addSSVCDecision(vul, data) {
	const url = `${API_URL}/api/case/vul/${vul.id}/ssvc/`;
        return axios.post(url, data).then(response => response.data);
    }

    removeSSVCDecision(vul) {
	const url = `${API_URL}/api/case/vul/${vul.id}/ssvc/`;
        return axios.delete(url).then(response => response.data);
    }

    updateSSVCDecision(vul, data) {
        const url = `${API_URL}/api/case/vul/${vul.id}/ssvc/`;
        return axios.patch(url, data).then(response => response.data);
    }


    getCSAFSettings(c) {
	const url = `${API_URL}/api/case/${c.case}/settings/csaf/`;
	return axios.get(url).then(response => response.data);
    }

    saveCSAFSettings(c, data) {
	const url = `${API_URL}/api/case/${c.case}/settings/csaf/`;
	return axios.post(url, data).then(response=>response.data);
    }

    getCSAF(c) {
	const url = `${API_URL}/api/case/${c}/advisory/csaf/`;
        return axios.get(url).then(response => response.data);
    }
    
    getCurrentAdvisory(c) {
	const url = `${API_URL}/api/case/${c.case}/advisory/latest/`;
        return axios.get(url).then(response => response.data);	
    }

    getAdvisoryRevisions(c) {
	const url = `${API_URL}/api/case/${c.case}/advisory/`;
        return axios.get(url).then(response => response.data);	
    }

    saveAdvisory(c, data) {
	const url = `${API_URL}/api/case/${c.case}/advisory/`;
        return axios.post(url, data).then(response => response.data);
    }

    shareAdvisory(c) {
	const url = `${API_URL}/api/case/${c}/advisory/latest/`;
	const data = {'date_shared': format(new Date(), 'yyyy-MM-dd')}
        return axios.patch(url, data);
    }

    publishAdvisory(c, data) {
        const url = `${API_URL}/api/case/${c}/advisory/latest/`;
	data['date_published'] = format(new Date(), 'yyyy-MM-dd');
        return axios.patch(url, data);
    }

    updateRevisions(c, data) {
	const url = `${API_URL}/api/case/${c}/advisory/revisions/`;
	return axios.patch(url, data);
    }

    addImage(data) {
        let url = `${API_URL}/api/advisory/upload/`
	
        return axios.post(url, data, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }});
    }


    
}
