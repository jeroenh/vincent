import React, { useRef, useState, useEffect} from 'react';
//import CSAFContext from './CSAFContext';
import { Alert, Button, Row, Col } from "react-bootstrap";
import cvssv3 from "./schemas/cvss-v3.0.json";
import cvssv31 from "./schemas/cvss-v3.1.json";
import cvssv2 from "./schemas/cvss-v2.0.json";
import csaf_schema from "./schemas/csaf_json_schema.json";
import AdvisoryDropdown from "./AdvisoryDropdown";
import Editor from '@monaco-editor/react';
import {useParams, useNavigate, Link, useLocation} from "react-router";
import CaseThreadAPI from './ThreadAPI';
import '../css/casethread.css';

const caseapi = new CaseThreadAPI();

const CSAFValidatorModal = (props) => {


    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [caseInfo, setCaseInfo] = useState(location.state?.caseInfo);
    const [approval, setApproval] = useState(location.state?.approval || null);
    const [isLoading, setIsLoading] = useState(true);
    const [code, setCode] = useState(null);
    const [markers, setMarkers] = useState([]);
    const monacoRef = useRef(null);
    const [error, setError] = useState(null);

    
    function handleEditorDidMount(editor, monaco) {
        // here is another way to get monaco instance
        // you can also store it in `useRef` for further usage
        monacoRef.current = monaco;
    }

    const fetchInitialData = async() => {
	console.log(caseInfo);
        await caseapi.getCSAF(id).then((response) => {
            setCode(JSON.stringify(response, null, 2));
            setIsLoading(false);
        }).catch(err => {

	    if (err.response.status == 403) {
                navigate("../../err");
            } else if (err.response.status == 404) {
                setError("No advisory: Create advisory before viewing CSAF.");
            } else {
                console.log(err);
                setError(`API Error: ${err.message}`);
            }
            setIsLoading(false);
        });
    }

    useEffect(() => {
        fetchInitialData();
        if (id)	{
            document.title = `VINCE-NT Case#${id} CSAF Validator`;
	}
    }, []);

    function editorWillMount(monaco) {

        monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
            enableSchemaRequest: true,
            validate: true,
            schemas: [{
                uri: '',
                fileMatch: ['*'],
                schema: csaf_schema,
            },
                      {
                          uri: 'cvss-v2.0.json',
                          schema: cvssv2
                      },
                      {
                          uri: 'cvss-v3.1.json',
                          schema: cvssv31
                      },
                      {
                          uri: 'cvss-v3.0.json',
                          schema: cvssv3
                      },

                     ]
        });
    }


    const downloadJson = () => {
	const jsonString = code;
	const blob = new Blob([jsonString], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = `csaf${id}.json`; // default filename
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
    };
        
    
    function handleEditorValidation(markers) {

	// model markers
	if (code !== "{}") {
	    markers.forEach((marker) => console.log('onValidate:', marker));
	    setMarkers(markers);
	}
    }


    return (
	<>
	    <AdvisoryDropdown
		page="CSAF Validator"
		caseInfo={caseInfo}
		download={downloadJson}
		approval={approval}
		update={fetchInitialData}
            />
	    {/*
		{!isLoading && markers.length == 0 &&
		 <Button variant="outline-primary" onClick={downloadJson}>
		     Download JSON
		 </Button>
		 }*/}

	    <div className="content-form">
		{isLoading ?
		 <div className="text-center">
                     <div className="lds-spinner"><div></div><div></div><div></div></div>
		 </div>
		 :
		 
		 
	     <Row>
		{error &&
		 <Alert variant="danger">{error}</Alert>
		} 
		 

		 <Alert variant="info">Changes made in this editor are not saved to the case!</Alert>
		 <Col lg="9" className="json-e">
		     <div className="csaf-editor d-flex h-full bg-white">
			 <Editor
			     width="100%"
			     height="100%"
			     theme="vs-white"
			     defaultLanguage="json"
			     value={code}
			     defaultValue=""

			     onValidate={handleEditorValidation}
			     beforeMount={editorWillMount}
			     onMount={handleEditorDidMount}
			 />
		     </div>
		 </Col>
		  <Col lg="3">
		      <h4>Validation</h4>
		      {markers.length > 0 ?
		       <ul>
			   {markers.map((mark, idx) => {
			       return (
				   <li key={`mark-${idx}`}><b>Line No. {mark.startLineNumber}</b> {mark.message} </li>
				   
			       )
			   })}
		       </ul>
		       :
		       <p className="lead"><i className="fas fa-check goodtext"></i> Valid CSAF File</p>
		      }
		  </Col>
		 
	     </Row>
	    }

	</div>
	</>
    )

}


export default CSAFValidatorModal;

