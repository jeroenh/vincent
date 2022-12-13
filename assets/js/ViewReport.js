import React, { useState, useEffect } from 'react'
import {Modal, Card, Alert, DropdownButton, Dropdown, InputGroup, FloatingLabel, Form, Container, Row, Col, Tab, Tabs, Nav, Button} from 'react-bootstrap';
import '../css/casethread.css';
import {format, formatDistance} from 'date-fns';
import CaseThreadAPI from './ThreadAPI';
import {Link} from "react-router";

const threadapi = new CaseThreadAPI();

const ViewReport = ({report, owner, caseid}) => {

    const [showCopyModal, setShowCopyModal] = useState(false);

    let orig_report = report;
    let date = new Date(orig_report.received);

    const hideCopyModal = () => {
        setShowCopyModal(false);
    }

    const isDoubleArray = (x) => {

	if (Array.isArray(x)) {
	    return true;
	}

	return false;

    }
    

    const NestedQA = (props) => {

	return (
	    <div className="border-bottom border-top">
		{props.data.map((qa, idx) => (
		    <div key={`nested-qa_${idx}`}>
			<label className="form-label"><b>{ qa.question }</b></label>
			<br/>
			{Array.isArray(qa.answer) ?
			 <span className="answer">
			     <ul>
				 {qa.answer.map((answer, index) => {
				     if (Array.isArray(answer)) {
					 return (
					     <NestedQA
						 data={answer}
					     />
					 )
				     } else {
					 return (
					     <li key={index}>{answer}</li>
					 )
				     }
				 })
				 }
			     </ul>
			 </span>
			 :
			 <span className="answer">{ qa.answer }</span>
			}
		    </div>
		))}
	    </div>
	)
    }


    const CopyReportPrompt = (props) => {
	const [loading, setLoading] = useState(true);
	const [report, setReport] = useState(null);
	const [error, setError] = useState(null);

	const loadOriginalReport = async () => {
	    await threadapi.getOriginalReport(props.caseid).then((response) => {
                setReport(response.data);
		setLoading(false);
            }).catch(err => {
                setError(<Alert variant="danger">Error loading report.</Alert>)
            });
        }
	
	
	useEffect(() => {

	    if (props.show) {
		setLoading(true);
		loadOriginalReport();
	    }
	    
	}, [props.show]);

	
	return (
            <Modal show={props.show} centered size="lg" onHide={props.hide} backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Original Report</Modal.Title>
                </Modal.Header>
                <Modal.Body>
		    {loading ?
		     <div className="text-center">
                         <div className="lds-spinner"><div></div><div></div><div></div></div>
                     </div>
		     :
		     <>
			 <Alert variant="warning">You are viewing the original version of this report.</Alert>
			 {report.report.map((r, index) => {
                             return (
				 <Row key={`ques-${index}`}>
                                     <Col lg={12} className="mb-2" key={index}>
					 <label className="form-label"><b>{ r.question }</b> {r.priv && <small className="warningtext">[Hidden]</small>}</label>
					 <br/>
					 {Array.isArray(r.answer) ?
					  <>
					      {isDoubleArray(r.answer) ?
					       <ul>
						   {r.answer.map((answer, index) => {
						       if (Array.isArray(answer)) {
							   return (
							       <React.Fragment key={`dbl-${index}`}>
								   <NestedQA
								       data={answer}
								   />
							       </React.Fragment>
							   )
						       } else {
							   return (
							       <div className="me-2" key={index}>{answer}</div>
							   )
						       }
						   })
						   }
					       </ul>
					       :
					       <span className="answer">
						   <ul>
						       {r.answer.map((answer, index) => (
							   <li key={index}>{answer}</li>
						       ))}
						   </ul>
					       </span>
					      }
					  </>
					  
					  :
					  <span className="answer">{ r.answer }</span>
					 }
                                     </Col>
				 </Row>
                             )
			     
			 })}
		     </>
		    }
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={props.hide}>
                        Done
                    </Button>
                </Modal.Footer>
            </Modal>
        )
    }



    return (
        <div>
	    {owner &&
	     <div className="d-flex justify-content-between">
		 <p className="lead">
		     {report.transfer ?
		      <>Report transferred from <b>{orig_report.submitter}</b> </>
		      :
		      <>
			  Report submitted
			  {orig_report.submitter ?
			   <> by <b>{orig_report.submitter}</b> </>
			   :
			   <> anonymously </>
			  }
			  on {format(date, 'yyyy-MM-dd')}
		      </>
		     }
		 </p>
                 <div className="text-end">
                     <DropdownButton variant="btn p-0"
				     id="detail-dropdown"
                                     title={<i className="bx bx-dots-vertical-rounded" title="Manage Report"></i>}
                     >
                         <Dropdown.Item eventKey="edit" href={`${caseid}/report/edit/`}>Edit Report</Dropdown.Item>
			 {report.copy &&
			  <Dropdown.Item eventKey="original" onClick={()=>setShowCopyModal(true)}>View Original Report</Dropdown.Item>
			 }
		     </DropdownButton>
		     <CopyReportPrompt
                         show={showCopyModal}
                         hide={hideCopyModal}
			 caseid={caseid}
                     /> 
		 </div>
	     </div>
	    }
            <Row>
		{orig_report.report.map((r, index) => {
		    let cols = 6;
		    if (isDoubleArray(r.answer)) {
			cols = 12;
		    }
                    return (
			<Col lg={cols} className="mb-2"  key={index}>
                            <label className="form-label"><b>{ r.question }</b></label>
			    <br/>
                            {Array.isArray(r.answer) ?
			     <>
				 {isDoubleArray(r.answer) ?
				  <>
                                     {r.answer.map((answer, index) => {
					 if (Array.isArray(answer)) {
					     return (
						 <React.Fragment key={`dbl-${index}`}>
						     <NestedQA
							 data={answer}
						     />
						 </React.Fragment>
					     )
					 } else {
                                             return (
						 <div className="me-2" key={index}>{answer}</div>
                                             )
					 }
                                     })
                                     }
				  </>
				  :
				  <span className="answer">
                                      <ul>
					  {r.answer.map((answer, index) => (
					      <li key={index}>{answer}</li>
					  ))}
				      </ul>
				  </span>
				 }
			     </>
			     
			     :
                             <span className="answer">{ r.answer }</span>
                            }
                    </Col>
                )
            })}
            </Row>
        </div>
    )
}

export default ViewReport;
