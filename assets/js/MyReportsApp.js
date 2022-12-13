import React, { useState, useEffect } from 'react'
import {Card, Alert, Row, Col, Badge, Button} from 'react-bootstrap';
import { format, formatDistance } from 'date-fns'
import FormAPI from './FormAPI';
import DisplayStatus from './DisplayStatus';

const formapi = new FormAPI();


const MyReportsApp = (props) => {

    const [reports, setReports] = useState([]);
    const [error, setError] = useState(null);

    const fetchInitialData = async () => {
        await formapi.getSubmissions().then((response) => {
	    let data = response.data;
            setReports(data);
        })
	    .catch (err => {
		setError(`Error loading reports: ${err.message}`);
		console.log('Error:', err)
	    })

    }

    useEffect(() => {
        fetchInitialData();
    }, [])



    const NestedQA = (props) => {

        return (
            <div className="border-bottom">
                {props.data.map((qa, idx) => (
		    <React.Fragment key={`nested-qa_${props.index}-${idx}`}>
			<div className="fs-6 text-uppercase"><b>{qa.question}</b></div>
			<div className="mw-2">
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
		    </React.Fragment>
                ))}
            </div>
        )
    }




    const isDoubleArray = (x) => {

        if (Array.isArray(x)) {
            return true;
        }

        return false;

    }

    return (
	error ?
	    <Alert variant="danger">{error}</Alert>
	:
	<>
	{reports && reports.length > 0 ?
	 <Row xs={1} md={2} className="g-4">
	     {reports.map((item, idx) => {
		 let date = new Date(item.received);
		 let today = new Date();
		 let timeago = formatDistance(date, today, {addSuffix: true});
		 var diffMins = Math.floor(((Math.abs(today-date)/1000)/60));

		 let newreport = (diffMins < 10) ? "unseen" : "";
		 return (
		 <Col key={`report-${idx}`}>
		     <Card className={newreport}>
			 <Card.Header className='d-flex align-items-center justify-content-between pb-0'>
			     <h4>{item.case_url ?
				  <a href={`${item.case_url}`}>
				  {item.case_id} {item.title}</a>
				   :
				  <>{item.case_id} {item.title}</>
				  }
				   </h4>
			     <DisplayStatus
				     status={item.status}
			     />
			 </Card.Header>

			 <Card.Body className='mb-0 pb-0'>
			 <div className="fs-6 text-uppercase">received {format(date, 'yyyy-MM-dd H:mm:ss ')} ({timeago})</div>
			 </Card.Body>
			 <hr/>
			 <Card.Body>
			     {item.report.map((q, index) => (
				 <React.Fragment key={`report-${index}`}>
				     <div className="fs-6 text-uppercase"><b>{q.question}</b></div>
				     <div className="mw-2">
					 {Array.isArray(q.answer) ?
					  <>
					      {isDoubleArray(q.answer) ?
					       <>
						   {q.answer.map((answer, idx) => {
						       if (Array.isArray(answer)) {
							   return (
							       <React.Fragment key={`dbl-${index}-${idx}`}>
								   <NestedQA
								       index={index}
								       data={answer}
								   />
							       </React.Fragment>
							   )
							   
						       } else {
							   return (
							       <React.Fragment key={`ans-${index}-${idx}`}>
								   {answer}
							       </React.Fragment>
							   )
						       }
						   })}
					       </>
					       :
					       <>
						   {q.answer.join(" ")}
					       </>

					      }
					  </>
					  :
					  <>
					      {q.answer}
					  </>
					 }
				     </div>
				 </React.Fragment>
			     ))}
			 </Card.Body>
		     </Card>
		 </Col>
		 )})
	     }
	 </Row>
	 :
	 <Row>
	     <Col lg={8}>
	 <Card>
	     <Card.Header as="h5" className="d-flex justify-content-between">
		 <Card.Title>
		     No vulnerability reports available.
		 </Card.Title>
		 <Button variant="primary" href="/cvdp/report/">Submit a Report</Button>
	     </Card.Header>
	 </Card>
	     </Col>
	 </Row>

	}
	</>
    )

}

export default MyReportsApp;
