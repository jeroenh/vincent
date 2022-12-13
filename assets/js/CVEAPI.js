import axios from 'axios';
let appConfig = {};
try {
	appConfig = JSON.parse(window.VINCENT_DATA);
} catch (e) {}
const SSVC_ROLE = appConfig.ssvc_role || 'TEST ROLE';
const API_URL = appConfig.api_url || 'http://localhost:8000/cvdp';
const CVE_URL = appConfig.cve_url || 'https://cveawg.mitre.org/api/';

export default class CVEAPI{

    constructor(org_name=null, user=null, api_key=null, url=null) {
	this.org_name = org_name;
	this.user = user;
	this.api_key = api_key;
	/* use production or default if not provided */
	this.url = url ? url : CVE_URL;
	this.user_path = "/org/"+this.org_name+"/user/"+this.user;
	this.headers = { headers: {'CVE-API-KEY': this.api_key,
				   'CVE-API-ORG': this.org_name,
				   'CVE-API-USER': this.user },
		       }
    }

    getORG() {
	let url = `${this.url}org/${this.org_name}`;
	return axios.get(url, this.headers);
    }

    
    getUser(username) {
	let url = this.user_path;
	if (username) {
	    url = `${this.url}org/${this.org_name}/user/${username}`;
	}
	//console.log(url);
	//console.log(this.headers);
	return axios.get(url, this.headers)
    }

    listUsers() {
	let url = `${this.url}org/${this.org_name}/users`;
	return axios.get(url, this.headers).then(response => response.data);
    }

    listCVEs(page=null) {
	let url = `${this.url}cve-id/`;
	if (page) {
	    url = `${this.url}cve-id?page=${page}`;
	}
	return axios.get(url, this.headers).then(response => response.data);
    }

    resetKey(username) {
	let url = `${this.url}org/${this.org_name}/user/${username}/reset_secret`;
	return axios.put(url, null, this.headers).then(response=>response.data);
    }

    getCVEMeta(id) {
	let url = `${this.url}cve-id/${id}`;
        return axios.get(url, this.headers).then(response => response.data);
    }
    getCVE(id, cancel=null) {
	let url = `${this.url}cve/${id}`;
	return axios.get(url).then(response => response.data);
    }

    getCVEsByYear(year) {
	let url = `${this.url}cve-id?cve_id_year=${year}`;
        return axios.get(url, this.headers).then(response => response.data);
    }
    
    addUser(data) {
	let url = `${this.url}org/${this.org_name}/user`;
	return axios.post(url, data, this.headers).then(response=>response.data);
    }

    editUser(username, data) {
	let params = new URLSearchParams();
	Object.keys(data).forEach(function(v) {
	    params.append(v, data[v]);
	});
	params = params.toString();
	let url = `${this.url}org/${this.org_name}/user/${username}?` + params;
	return axios.put(url, null, this.headers).then(response=>response.data);
    }

    deactivateUser(username) {
        const params = new URLSearchParams({
            'active': false
        }).toString();
        let url = `${this.url}org/${this.org_name}/user/${username}?` + params;
        return axios.put(url, null, this.headers).then(response=>response.data);
    }

   reactivateUser(username) {
       const params = new URLSearchParams({
           'active': true
       }).toString();
       let url = `${this.url}org/${this.org_name}/user/${username}?` + params;
       return axios.put(url, null, this.headers).then(response=>response.data);
   }


    reserve1CVE() {
	let currentYear = new Date().getFullYear();
	const params = new URLSearchParams({
            'amount': 1,
            'batch_type': 'Sequential',
            'cve_year': currentYear,
            'short_name': this.org_name
        }).toString();
        let url = `${this.url}cve-id?` + params;
        return axios.post(url, null, this.headers)
    }
    
    reserveCVEs(data) {
	const params = new URLSearchParams({
	    'amount': data.amount,
	    'batch_type': data.batch_type,
	    'cve_year': data.cve_year,
	    'short_name': data.short_name
        }).toString();
        let url = `${this.url}cve-id?` + params;
        return axios.post(url, null, this.headers).then(response=>response.data);
    }

    publishCVE(cve, data) {

	let url = `${this.url}cve/${cve}/cna`;
	return axios.post(url, data, this.headers)
    }

    putCVE(cve, data) {
	let url = `${this.url}cve/${cve}/cna`;
        return axios.put(url, data, this.headers)
    }
    
    putADP(cve, data) {
	let url = `${this.url}cve/${cve}/adp`;
	return axios.put(url, data, this.headers)
    }

    generateCVEJson(vul) {

	let json = {};
        let cnacontainer = {};
        json['descriptions'] = [{"lang": "en", "value": vul.description}];
        json["affected"] = []

	if (!(vul.references && vul.references.length > 0 &&
	      vul.affected_products && vul.affected_products.length > 0
	      && vul.problem_types && vul.problem_types.length > 0
	      && vul.date_public)) {
            return null;
        }

	vul.affected_products.forEach((v) => {
            let versions = [];
            v.status.forEach((stat) => {
                let vul_status = stat["status"];
                switch(vul_status) {
                case 'Not Affected':
                case 'Fixed':
                    vul_status = "unaffected";
                    break;
                case 'Affected':
                    vul_status = "affected";
                    break;
                default:
                    vul_status = "unknown";
                }
		if (stat["version_range"] == "<" && stat["version_end_range"] && stat["version_type"]) {
                    versions.push({"version": stat["version_value"],
                                   "status": vul_status,
                                   "lessThan": stat["version_end_range"],
                                   "versionType": stat["version_type"]
                                  })
                } else if (stat["version_range"] == "<=" && stat["version_end_range"] && stat["version_type"]) {
                    versions.push({"version": stat["version_value"],
                                   "status": vul_status,
                                   "lessThanOrEqual": stat["version_end_range"],
                                   "versionType": stat["version_type"]
                                  })
                } else {
                    versions.push({"version": stat["version_value"],
                                   "status": vul_status})
                }
            })
            json["affected"].push({"vendor": v.vendor, "product": v.product,
                                   "defaultStatus": v.default_status.toLowerCase(),
                                   "versions": versions});
	    
        });
	
	if (vul.cve_tags && vul.cve_tags.length > 0) {
            json["tags"] = vul.cve_tags;
        }
        json["problemTypes"] = [];
	
        vul.problem_types.forEach((vul) => {
            let cwetype = vul.replace(/ .*/,'');
            let descriptions = [];
            if (cwetype === "CWE-noinfo") {
                descriptions.push({"description": vul,
                                   "lang": "en"});
            } else {
                descriptions.push({"description": vul,
                                   "lang": "en",
                                   "type": "CWE",
                                   "cweId": cwetype})
            }
            json["problemTypes"].push({"descriptions": descriptions});
        });
	
	if (vul.cvss.length > 0) {
            json["metrics"] = [];
            vul.cvss.forEach(vcvss => {
                if (Object.keys(vcvss.metrics_json).length > 0) {
                    json["metrics"].push(vcvss.metrics_json);
                } else {
                    if (vcvss.version == "4.0") {
                        let vec = new CVSS40(vcvss.vectorString);
                        // could use above to get all score parameters                                                                                      
                        let score = vec.Score();
                        let severity = CVSS40.Rating(score);
                        json["metrics"].push({"cvssV4_0": {baseScore: parseFloat(vcvss.score),
							   baseSeverity: severity.toUpperCase(),
							   version: "4.0",
							   vectorString: vcvss.vectorString},
					      format: "CVSS"});
			
                    } else if (vcvss.version == "3.1") {
                        json["metrics"].push({"cvssV3_1": {baseScore: parseFloat(vcvss.score),
							   baseSeverity: vcvss.severity,
							   version: "3.1",
							   vectorString: vcvss.vectorString},
					      format: "CVSS"});
                    }
                }
            })
        }
	
	if (vul.ssvc_vector) {
            let new_array = {};
            vul.ssvc_decision_tree.forEach(item => {
                new_array[item.label] = item.value
            })
	    
            let new_content = {
                "timestamp": new_array['date_scored'],
                "id": vul.vul,
                "options": [
                    {
                        "Exploitation": new_array['Exploitation']
                    },
                    {
                        "Automatable": new_array["Automatable"]
                    },
                    {
                        "Technical Impact": new_array["Technical Impact"]
                    }
                ],
                "role": SSVC_ROLE,
                "version": "2.0.3"
            }
	    
	    if ("metrics" in json) {
                json["metrics"].push({"other": {"type": "ssvc", "content": new_content}})
            } else {
                json['metrics'] = [{"other": {"type": "ssvc", "content": new_content}}]
            }
        }
	
        if (vul.title) {
            json["title"] = vul.title;
        }
	
        json["references"] = [];
        vul.references.forEach((vul) => {
            json["references"].push({"name":"url", "url":vul.url});
        });
	
	
	if (vul.acknowledgments && vul.acknowledgments.length > 0) {
            json["credits"] = []
            vul.acknowledgments.forEach((ack) => {
                /* wrap in a try block since I added org at some point */
                try {
                    if (ack.organization != "") {
                        json["credits"].push({"value": `${ack.names}, ${ack.organization}`, "lang": "en"});
                    } else {
                        json["credits"].push({"value": ack.names, "lang": "en"});
                    }
                } catch (err) {
                    json["credits"].push({"value": ack.names, "lang": "en"});
                }
            })
        }
	
	let dateObj = new Date(vul.date_public);
        json["datePublic"] = dateObj.toISOString();
	
	cnacontainer['cnaContainer'] = json
	
	return cnacontainer
    }
    
}

