import axios from 'axios';

let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';

axios.defaults.xsrfHeaderName = "X-CSRFToken"
axios.defaults.xsrfCookieName = 'csrftoken'


export default class FormAPI{

    constructor(){}

    getForm(c) {
        const url = `${API_URL}/api/manage/form/${c}/`;
        return axios.get(url).then(response => response.data);
    }

    removeForm(c) {
	const url = `${API_URL}/api/manage/form/${c}/`;
        return axios.delete(url).then(response => response.data);
    }
    
    getQuestionTypeOptions(c) {
        const url = `${API_URL}/api/manage/form/${c}/question/`;
        return axios.options(url).then(response => response.data);
    }

    
    getQuestions(c) {
	const url = `${API_URL}/api/manage/form/${c}/question/`;
	return axios.get(url).then(response => response.data);
    }

    addQuestion(c, data) {
	const url = `${API_URL}/api/manage/form/${c}/question/`;
	return axios.post(url, data).then(response => response.data);
    }

    updateQuestion(c, data) {
	const url = `${API_URL}/api/manage/form/question/${c}/`;
	return axios.patch(url, data).then(response => response.data);
    }

    deleteQuestion(c) {
    	const url = `${API_URL}/api/manage/form/question/${c}/`;
	return axios.delete(url).then(response => response.data);
    }

    getSubmissions() {
        const url = `${API_URL}/api/form/submissions/`;
	return axios.get(url);
    }
    
}
