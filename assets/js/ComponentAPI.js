import axios from 'axios';
import { useNavigate } from "react-router";
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';

axios.defaults.xsrfHeaderName = "X-CSRFToken"
axios.defaults.xsrfCookieName = 'csrftoken'


export default class ComponentAPI {

    constructor(useInterceptor=false, navigateFn=null){
	this.navigateFn = navigateFn;
	this.useInterceptor = useInterceptor;
	if (this.useInterceptor) {
	    axios.interceptors.response.use(
		response=>response,
		error => {
		    if (error.response?.status === 403 || error.response?.status === 500) {
			navigateFn(error);
		    }
		    return Promise.reject(error);
		}
	    )
	}
	
    }

    getUser() {
	const url = `${API_URL}/api/user/`;
        return axios.get(url).then(response => response.data);
    }
    
    getComponentOptions() {
        const url = `${API_URL}/api/components/`;
        return axios.options(url).then(response => response.data);
    }
    
    getDependencies(item, query=null) {
	/* ignore interrupt so we can display correct response */
        const ignoreInterrupt = axios.create();
	let url = `${API_URL}/api/component/${item}/dependency/`;
	if (query) {
            url = `${API_URL}/api/component/${item}/dependency/?${query}`;
	}
        return ignoreInterrupt.get(url).then(response => response.data);
    }


    getProduct(c) {
	let url = `${API_URL}/api/component/${c}/`;
        return axios.get(url);
    }

    getComponent(c) {
	let url = `${API_URL}/api/component/${c}/`;
        return axios.get(url);
    }
    
    getComponentCases(c) {
	let url = `${API_URL}/api/components/${c}/cases/`;
	return axios.get(url).then(response => response.data);
    }

    getComponentActivity(c) {
	let url = `${API_URL}/api/component/${c.id}/activity/`;
        return axios.get(url).then(response => response.data);
    }
    
    getComponents(query, cancel) {
	let url = `${API_URL}/api/components/`;
	if (query) {
            url = `${API_URL}/api/components/?${query}`;
	}
        return axios.get(url, {signal: cancel}).then(response => response.data);
    }


    sortComponents(column, direction, query, cancel) {
	let url = `${API_URL}/api/components/`;
	let sort = `ordering=-${column}`;

	if (direction === "none") {
	    if (query) {
		url = `${API_URL}/api/components/?${query}`;
	    }
	} else {
	    if (direction === "ASC") {
                sort = `ordering=${column}`;
            }
            if (query) {
	        url = `${API_URL}/api/components/?${query}&${sort}`;
            } else {
                url = `${API_URL}/api/components/?${sort}`;
            }
        }
	return axios.get(url, {signal: cancel}).then(response=>response.data);
    }


    sortGroupComponents(c, column, direction, query, cancel) {
        let url = `${API_URL}/api/group/${c}/components/`;
        let sort = `ordering=-${column}`;
	
        if (direction === "none") {
            if (query) {
                url	= `${API_URL}/api/group/${c}/components/?${query}`;
	    }
        } else {
            if (direction === "ASC") {
                sort = `ordering=${column}`;
            }
            if (query) {
                url = `${API_URL}/api/group/${c}/components/?${query}&${sort}`;
            } else {
                url = `${API_URL}/api/group/${c}/components/?${sort}`;
            }
        }
        return axios.get(url, {signal: cancel}).then(response=>response.data);
    }
    
    getNextComponents(url) {
	return axios.get(url).then(response=>response.data);
    }

    
    getGroupComponents(c, query=null, cancel) {
	let url = `${API_URL}/api/group/${c}/components/`;
	if (query) {
	    url = `${API_URL}/api/group/${c}/components/?${query}`;
	}
        return axios.get(url, {signal: cancel}).then(response => response.data);
    }

    getNextGroupComponents(url) {
	return axios.get(url).then(response=>response.data);
    }
    
    getComponentForm() {
	const url = `${API_URL}/components/add/`;
        return axios.get(url).then(response => response.data);
    }

    addGroupComponent(g, data) {
	const url = `${API_URL}/api/group/${g}/components/`;
        return axios.post(url, data).then(response=>response.data);
    }
    
    getEditComponentForm(c) {
        const url = `${API_URL}/components/${c}/edit/`;
	console.log(url);
        return axios.get(url).then(response => response.data);
    }
    
    addComponent(data) {
	const url = `${API_URL}/api/components/`;
        return axios.post(url, data).then(response => {
	    console.log(response);
	    return response.data
	});
    }

    addDependency(item, deps) {
	const url = `${API_URL}/api/component/${item}/dependency/`;
	const data = {'dependency': deps[0]}
        return axios.all(deps.map((item) => {data.dependency=item; axios.patch(url, data)})).then((data) => data)
    }

    addOneDependency(item, data) {
	const url = `${API_URL}/api/component/${item}/dependency/`;
	return axios.patch(url, data);
    }

    getAddDependencyURL(item) {
	const url = `${API_URL}/api/component/${item}/dependency/`;
	return url;
    }
    
    updateComponent(c, data) {
	const url = `${API_URL}/api/component/${c}/`;
        return axios.patch(url, data).then(response=>
	    response.data);
    }

    updateComponentOwner(data) {
	console.log(data);
	const url = `${API_URL}/components/update/owner/`;
        return axios.post(url, data);
    }
    
    removeComponents(c) {
	const requests = c.map((item) => `${API_URL}/api/component/${item}/`);
        return axios.all(requests.map((item) => axios.delete(item))).then((data) => data)
    }

    removeComponent(c) {
	const url = `${API_URL}/api/component/${c}/`;
	return axios.delete(url).then(response => response.data);
    }
    
    getComponentStatus(c) {
	const url = `${API_URL}/api/case/${c.case_id}/components/`;
        return axios.get(url).then(response => response.data);
    }

    getUnapprovedComponentStatus(c) {
	const url = `${API_URL}/api/case/${c.case_id}/components/?current_revision__approved=false`;
        return axios.get(url).then(response => response.data);
    }

    approveComponentStatus(c) {
	const data = {'approved': true}
        const url = `${API_URL}/api/case/component/${c}/status/approve/`;
        return axios.patch(url, data).then(response => response.data);
    }

    approveAll(c) {
	const data={'approved': true}
	const url = `${API_URL}/api/case/component/${c.case_id}/status/approve/all/`;
        return axios.patch(url, data).then(response => response.data);
    }

    getComponentNext(url) {
	return axios.get(url).then(response=>response.data);
    }
    
    getComponentStatusOrder(c, order) {
        let url = `${API_URL}/api/case/${c.case_id}/components/`;
	if (order) {
	    url = `${API_URL}/api/case/${c.case_id}/components/${order}`;
	}
        return axios.get(url).then(response => response.data);
    }

    getCompStatusTable(c, order){
	let url = `${API_URL}/api/case/${c.case_id}/components/status/`;
        if (order) {
            url = `${API_URL}/api/case/${c.case_id}/components/status/${order}`;
        }
        return axios.get(url).then(response => response.data);
    }

    getCompStatusUploads(c) {
	const url = `${API_URL}/api/case/${c.case_id}/status/transfers/`;
        return axios.get(url).then(response => response.data);
    }


    getComponentStatusActivity(c) {
	const url = `${API_URL}/api/case/component/${c}/status/revisions/`;
        return axios.get(url).then(response => response.data);
    }
    
    addStatus(c, data) {
	const url = `${API_URL}/api/case/${c.case_id}/components/`;
        return axios.post(url, data).then(response=>response.data);
    }

    removeStatus(c) {
	const url = `${API_URL}/api/case/component/${c}/status/`;
        return axios.delete(url).then(response=>response.data);
    }

    editStatus(c, data) {
        const url = `${API_URL}/api/case/component/${c}/status/`;
	return axios.patch(url, data).then(response=>response.data);
    }

    loadSPDX(data, group=null) {
	let url = `${API_URL}/api/components/upload/`;
	if (group) {
	    url = `${API_URL}/api/components/group/${group}/upload/`;
	}
	return axios.post(url, data, {
            headers: {
		'Content-Type': 'multipart/form-data'
            }}).then(response => response.data);
    }
    
    getSPDX(c, format="json") {
	const ignoreInterrupt = axios.create();
	let url = `${API_URL}/component/${c.id}/sbom/download/?format=${format}`;
        return ignoreInterrupt.get(url, {responseType: 'blob'})
    }

    mergeStatus(id) {
	let formField = new FormData();
        formField.append('merged', 1);
	let url = `${API_URL}/api/case/status/transfer/${id}/`;
	return axios.patch(url, formField).then(response => response.data);
    }

    rejectStatus(id) {
	let formField = new FormData();
	formField.append('deleted', 1);
	let url = `${API_URL}/api/case/status/transfer/${id}/`;
        return axios.patch(url, formField).then(response => response.data);	
    }
}

