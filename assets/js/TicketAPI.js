import axios from 'axios';
import { useNavigate } from "react-router";
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';

axios.defaults.xsrfHeaderName = "X-CSRFToken"
axios.defaults.xsrfCookieName = 'csrftoken'


export default class TicketAPI {

    getUnassigned(url, team=null) {
	if (!url) {
	    url = `${API_URL}/api/tickets/unassigned/`;
	}
	if (team) {
	    url = `${url}?team=${team}`;
	}
        return axios.get(url).then(response => response.data);
    }

    getUnassignedStatus(status) {
	let url = `${API_URL}/api/tickets/unassigned/?status=${status}`;
	return axios.get(url).then(response => response.data);
    }

    getUserAssignments() {
        const url = `${API_URL}/api/user/assignments/?coordinator=1`;
        return axios.get(url).then(response => response.data);
    }
    
    getUser() {
        const url = `${API_URL}/api/user/`;
        return axios.get(url).then(response => response.data);
    }
    
    getTicket(id) {
	const url = `${API_URL}/api/ticket/${id}/`;
	return axios.get(url).then(response => response.data);
    }


    getMyTickets(urlstr) {
	const url = `${API_URL}/api/tickets/${urlstr}`;
        return axios.get(url).then(response => response.data);
    }
    
    getTicketActivity(ticket) {
        const url = `${API_URL}/api/ticket/${ticket.id}/activity/`;
        return axios.get(url).then(response => response.data);
    }

    addTicketComment(ticket, data) {
	const url = `${API_URL}/api/ticket/${ticket.id}/activity/`;
        return axios.post(url, data).then(response => response.data);
    }
    
    getThreadTickets(id) {
	const url = `${API_URL}/api/thread/${id}/`;
        return axios.get(url).then(response => response.data);
    }


    assignTicket(ticket, assign) {
	const data = {'assign': assign}
        const url = `${API_URL}/api/ticket/${ticket.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    assignTicketTeam(ticket, assign) {
	const data = {'team': {'uuid': assign}}
        const url = `${API_URL}/api/ticket/${ticket.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }
    
    autoAssignTicket(ticket, role) {
	const data = {'role': role, 'assign': 1}
        const url = `${API_URL}/api/ticket/${ticket.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }

    updateTicket(ticket, data) {
	const url = `${API_URL}/api/ticket/${ticket.id}/`;
        return axios.patch(url, data).then(response=>response.data);
    }
    
    getCaseTickets(id, urlstr) {
	const url = `${API_URL}/api/case/${id}/tickets/${urlstr}`;
        return axios.get(url).then(response => response.data);
    }

    getTickets(url) {
	return axios.get(url).then(response => response.data);
    }

    getCaseNotes(id) {
	const url = `${API_URL}/api/case/${id}/notes/`;
        return axios.get(url).then(response => response.data);
    }

    writeCaseNote(id, data) {
	const url = `${API_URL}/api/case/${id}/notes/`;
	return axios.post(url, data).then(response => response.data);
    }

    updateCaseNote(id, data) {
        const url = `${API_URL}/api/note/${id}/`;
        return axios.patch(url, data).then(response => response.data);
    }

    filterCaseNotes(id, urlstr) {
	const url = `${API_URL}/api/case/${id}/notes/${urlstr}`;
        return axios.get(url).then(response => response.data);
    }

    createCase(ticket) {
	const data = {summary: ticket.content, title: ticket.title};
	const url = `${API_URL}/api/cases/`;
	return axios.post(url, data).then(response => response.data);
    }


	

    
}
