import React, { useRef, useState, useEffect, useCallback } from 'react';
import {Card, DropdownButton, Dropdown, InputGroup, Form, Row, Col, Table, Accordion, Alert, Button} from 'react-bootstrap';
import CaseThreadAPI from './ThreadAPI';
import { format, parseISO } from 'date-fns'
import {useParams, useNavigate, Link, useLocation} from "react-router"
import Messenger from './Messenger';
import {deserializer} from "./slatejs/utils/serializer.js"
import AdvisoryDropdown from "./AdvisoryDropdown";
import { formatInTimeZone } from 'date-fns-tz';

const threadapi = new CaseThreadAPI();

var globalref = null;

const initialValue = [
    {
        type: 'paragraph',
        children: [{ text: '' }],
    },
]



const AdvisoryApp = () => {

    const { id } = useParams();
    const messageRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [advisory, setAdvisory] = useState("");
    const [title, setTitle] = useState("");
    const [revisions, setRevisions] = useState([]);
    const [content, setContent] = useState(initialValue);
    const [invalidContent, setInvalidContent] = useState(false);
    const [log, setLog] = useState("");
    const [invalidTitle, setInvalidTitle] = useState(false);
    const [disableButton, setDisableButton] = useState(false);


    const uploadFiles = async(formData, filename) => {
        console.log(`Uploading ${filename}: ${formData}`);
        let data = await threadapi.addImage(formData);
        let results = await data.data;
        console.log(results);
        return results['image_url'];

    };


    
    const imageHandler = useCallback(() => {
	
        const input = document.createElement('input');
	
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = async () => {
            var file = input.files[0];
            var formData = new FormData();

            formData.append('image', file);

            var fileName = file.name;

            const res = await uploadFiles(formData, fileName);
            console.log(res);
            console.log(globalref);
            const range = globalref.current.selection;
            console.log(range);
            globalref.current.getEditor().insertEmbed(range.index, 'image', res);
	    globalref.current.getEditor().formatText(range.index, 1, 'width', '300px'); //to limit the width
            globalref.current.getEditor().setSelection(range.index + 1);

        };
    }, []);
    
   
    // Async Fetch
    const fetchInitialData = async () => {
	setLoading(true);
	
	if (caseInfo == null) {
            await threadapi.getCase({'case': id}).then((response) => {
                setCaseInfo(response);
            }).catch(err => {
		if (err.response.status == 403 || err.response.status==404) {
                    navigate("../err");
                }
		setError(`Error: ${err.message}`);
            });
	}
	
        await threadapi.getCurrentAdvisory({'case':id }).then(async function (response) {
            setAdvisory(response);
	    setTitle(response.title);

	    const doc = new DOMParser().parseFromString(response.content, 'text/html')
            const slate_json = deserializer(doc.body);
	    setContent(slate_json);
	    setLoading(false);

	    await threadapi.getAdvisoryRevisions({'case': id}).then((response)=> {
		setRevisions(response);
	    }).catch(err => {
		if (err.response.status == 403) {
		    navigate("../err");
		} else if (err.response.status != 404) {
		    setError(`Error: ${err.message}`);
		}
	    });

	    
        }).catch(err => {
	    if (err.response.status == 403) {
                navigate("../err");
            } else if (err.response.status == 404) {
		setLoading(false);
		setTitle(caseInfo?.title);
	    } else {
		setError(`Error: ${err.message}`);
	    }
	});

    };


    const saveAdvisory = () => {
	let formData = {}

	if (content === initialValue || content === JSON.stringify(initialValue)) {
            setInvalidContent(true);
            return
        }

        let html = messageRef.current.sanitizeHTML(content);

	setInvalidContent(false);
	formData['title'] = title
	formData['content'] = html
	formData['json_content'] = content
	formData['user_message'] = log

	threadapi.saveAdvisory({'case': id}, formData).then((response) => {
	    setSuccess("Got it! Advisory saved!");
	    fetchInitialData();
	}).catch(err => {
	    setError(`Error saving advisory: ${err.message}`);
	});
    }


    const printLocalTime = (d) => {

        if (d) {
            const localDate = parseISO(d.split('T')[0]);
            const formatted = format(localDate, 'yyyy-MM-dd');

            return formatted;
        } else {
            return '';
        }
    }
    
    useEffect(() => {
        fetchInitialData();
	if (id)	{
            document.title = `VINCE-NT Case#${id} Advisory`;
	}
    }, []);

    return (
	<>
	    {caseInfo &&
	         <AdvisoryDropdown
                     caseInfo={caseInfo}
	             csaf={null}
                     approval={null}
                     page="Advisory"
		     home={"editor"}
                 /> 
	    }
	    {loading ?
	     <div className="text-center"><div className="lds-spinner"><div></div><div></div><div></div></div></div>
	     :
             <Row>
		 <Col lg={8} md={8}>
		     {error &&
		      <Alert variant="danger">{error}</Alert>
		     }
		     {success &&
		      <Alert variant="success"> {success}</Alert>
		     }
		     <Form.Group className="mb-3" controlId="Title">
			 <Form.Label className="mb-0">Title</Form.Label>
			 <Form.Text>Case title is used for CSAF Document.</Form.Text>
			 <Form.Control name="title" isInvalid={invalidTitle} value={title} onChange={(e)=>setTitle(e.target.value)}/>
			 {invalidTitle &&
			  <Form.Text className="error">
                              This field is required.
			  </Form.Text>
			 }
                     </Form.Group>
		     <Card className="mb-3">
			 {invalidContent &&
			  <div className="alert alert-danger">This field is required.</div>
			 }
			 <Card.Body>
			     <Messenger
				 placeholder="Write your advisory contents here."
				 setValue={setContent}
				 value={content}
				 uploadFiles={uploadFiles}
				 ref={messageRef}
				 className="advisoryapp"
                             />  
			 </Card.Body>
			 
		    </Card>
		    <Form.Group className="mb-3" controlId="Log">
			<Form.Label>Revision Message</Form.Label>
			<Form.Control name="log" value={log} onChange={(e)=>setLog(e.target.value)}/>
                    </Form.Group>
		    <div className="mb-3">
			<Button type="Cancel" variant="secondary" onClick={(e)=>fetchInitialData()}>
			    Cancel
			</Button>
			<Button
                            variant="outline-primary"
                            className="float-end"
                            disabled={disableButton ? true : false}
                            onClick={(e)=>saveAdvisory()}>
                            {disableButton ? <>Saving...</>:<>Save</>}
			</Button>
		    </div>
		</Col>
		<Col lg={4}>
		    {revisions.length > 0 &&
		     <>
			 <div className="d-flex justify-content-between align-items-start">
			     <p className="lead">Revision History</p>
			     <Link
				 className="btn btn-outline-primary btn-sm"
				 type="button"
				 to="revisions/"
				 role="button"
				 state={{caseInfo: caseInfo}}
			     >
				 Edit
			     </Link>
			 </div>
				 
			 <Accordion id="advisory_revision_history">
			     {revisions.map((rev, index) => {
				 let created = new Date(rev.created);
				 return (
				     <Accordion.Item eventKey={index} key={`rev-${rev.revision_number}`}>
					 <Accordion.Header>
					     <div>
						 {rev.revision_number == advisory.revision_number ?
						  <i className="fas fa-flag"></i>
						  :
						  <i className="fas fa-plus"></i>
						 }
						 <span className="px-2">#{rev.revision_number} {formatInTimeZone(rev.created, 'UTC', 'yyyy-MM-dd')} by {rev.author}</span>
					     </div>
					 </Accordion.Header>
					 <Accordion.Body>
					     <div className="border-bottom pb-2 mb-2"><small>Log: {rev.user_message || "No log message"}</small></div>
					     
					     {rev.diff.length > 0 && (
						 <Table>
						     <tbody>
							 {
							     rev.diff.map((post, index) => {
								 let firstchar = post.charAt();
								 let cn = "equal";
								 switch(firstchar) {
								 case "-":
								     cn = "delete";
								     break;
								 case "+":
								     cn="insert";
								     break;
								 case "?":
								     cn="skip";
								     break;
								 default:
								     break;
								     
								 }
								 if (cn != "skip") {
								     return (
									 <tr className={cn} key={index}>
									     <td><div dangerouslySetInnerHTML={{__html: post}} /></td>
									 </tr>
								     )
								 }
							     })
							 }
						     </tbody>
						 </Table>
					     )
					     }
					 </Accordion.Body>
				     </Accordion.Item>
				 )
			     })}
			 </Accordion>
		     </>
		    }
		</Col>
	     </Row>
	    }
	</>
     )
}

export default AdvisoryApp;
