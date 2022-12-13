import React from 'react'
import { useState, useEffect, forwardRef, useImperativeHandle} from 'react';
import { Modal, Badge, Popover, OverlayTrigger, Row, Col, ToggleButtonGroup, ToggleButton, Tab, Tabs, Alert, Form, Button } from "react-bootstrap";
import {cvssConfig} from "./cvss_config.js"
import { CVSS40 } from '@pandatix/js-cvss';

const cvssMacroVectorDetails = {
  "Exploitability": 0,
  "Complexity": 1,
  "Vulnerable system": 2,
  "Subsequent system": 3,
  "Exploitation": 4,
  "Security requirements": 5
}

const cvssMacroVectorValues = {
  "0": "High",
  "1": "Medium",
  "2": "Low",
  "3": "None",
}

const baseMatrices = [
    {
	key: "AV",
	nvd: "attackVector",
	options: [
	    {key: 'N', name: "NETWORK"},
	    {key: 'A', name:"ADJACENT"},
	    {key: 'L', name:"LOCAL"},
	    {key: 'P', name:"PHYSICAL"},
	]
    },
    {
	key: "AC",
	nvd: "attackComplexity",
	options: [
	    {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
	]
    },
    {
	key: "AT",
	nvd: "attackRequirements",
	options: [
	    {key: 'N', name:"NONE"},
	    {key: 'P', name:"PRESENT"},
	]
    },
    {
	key: "PR",
	nvd: "privilegesRequired",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
	    {key: 'N', name:"NONE"},
	]

    },
    {
	key:"UI",
	nvd: "userInteraction",
	options: [
	     {key: 'N', name:"NONE"},
	    {key: 'P', name:"PASSIVE"},
	    {key: 'A', name:"ACTIVE"},
	]
    },
    {
	key:"VC",
	nvd: "vulnConfidentialityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
    },
    {
	key: "VI",
	nvd: "vulnIntegrityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
    },
    {
	key: "VA",
	nvd: "vulnAvailabilityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
    },
    {
	key: "SC",
	nvd: "subConfidentialityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
	
    },
    {
	key: "SI",
	nvd: "subIntegrityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
    },
    {
	key: "SA",
	nvd: "subAvailabilityImpact",
	options: [
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	]
    },
    {
	key: "E",
	nvd: "exploitMaturity",
	options: [
	    {key: 'U', name: "UNREPORTED"},
	    {key: 'P', name: "PROOF_OF_CONCEPT"},
	    {key: 'A', name: "ATTACKED"},
	    {key: 'X', name: "NOT_DEFINED"},
	]
    },
    {
	key: "CR",
	nvd: "confidentialityRequirement",
	options:[
            {key: 'H', name:"HIGH"},
	    {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
	    {key: 'X', name:"NOT_DEFINED"},
	    ]
    },
    {
        key: "IR",
        nvd: "integrityRequirement",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
	]
	
    },
    {
        key: "AR",
        nvd: "availabilityRequirement",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ]
    },
     {
         key: "MAV",
         nvd: "modifiedAttackVector",
	 options: [
            {key: 'N', name: "NETWORK"},
            {key: 'A', name:"ADJACENT"},
            {key: 'L', name:"LOCAL"},
             {key: 'P', name:"PHYSICAL"},
	     {key: 'X', name:"NOT_DEFINED"},
	 ],
     },
	{
        key: "MAC",
            nvd: "modifiedAttackComplexity",
	    options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'X', name:"NOT_DEFINED"},
	    ],
    },
    {
        key: "MAT",
        nvd: "modifiedAttackRequirements",
	options:
	[
            {key: 'N', name:"NONE"},
            {key: 'P', name:"PRESENT"},
	    {key: 'X', name:"NOT_DEFINED"},
	],
	
    },
    {
        key: "MPR",
        nvd: "modifiedPrivilegesRequired",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
	],
    },
    {
	key: "MUI",
	nvd: "modifiedUserInteraction",
	options: [
             {key: 'N', name:"NONE"},
            {key: 'P', name:"PASSIVE"},
            {key: 'A', name:"ACTIVE"},
	    {key: 'X', name:"NOT_DEFINED"},
	],
    },
    {
	key: "MVC",
	nvd: "modifiedVulnConfidentialityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
	],
    },
    {
        key: "MVI",
        nvd: "modifiedVulnIntegrityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ],
	
    },
    {
	key: "MVA",
	nvd: "modifiedVulnAvailabilityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ],
    },
    {
	key: "MSC",
	nvd: "modifiedSubConfidentialityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ],
    },
    {
	key: "MSI",
	nvd: "modifiedSubIntegrityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ],
    },
    {
	key: "MSA",
	nvd: "modifiedSubAvailabilityImpact",
	options: [
            {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'N', name:"NONE"},
            {key: 'X', name:"NOT_DEFINED"},
        ],
    },
    {
	key: "S",
	nvd: "Safety",
	options: [
	    {key: 'N', name:"NEGLIGIBLE"},
	    {key: 'P', name:"PRESENT"},
	    {key: 'X', name:"NOT_DEFINED"},
	],
    },
    {
	key: "AU",
	nvd: "Automatable",
	options: [
	    {key: 'N', name:"NO"},
	    {key: 'Y', name:"YES"},
	    {key: 'X', name:"NOT_DEFINED"},
	],
    },
    {
	key: "R",
	nvd: "Recovery",
	options: [
	    {key: 'A', name:"AUTOMATIC"},
	    {key: 'U', name:"USER"},
	    {key: 'I', name:"IRRECOVERABLE"},
	    {key: 'X', name:"NOT_DEFINED"}
	],
    },
    {
	key: "V",
	nvd: "valueDensity",
	options: [
	    {key: 'D', name:"DIFFUSE"},
	    {key: 'C', name:"CONCENTRATED"},
	    {key: 'X', name:"NOT_DEFINED"}
	],
    },
    {
	key: "RE",
	nvd: "vulnerabilityResponseEffort",
	options: [
	    {key: 'H', name:"HIGH"},
            {key: 'L', name:"LOW"},
            {key: 'M', name:"MODERATE"},
            {key: 'X', name:"NOT_DEFINED"},
	],
	
    },
    {
	key: "U",
	nvd: "providerUrgency",
	options: [
	    {key: 'Green', name:"GREEN"},
            {key: 'Amber', name:"AMBER"},
            {key: 'Red', name:"RED"},
	    {key: 'Clear', name:"CLEAR"},
            {key: 'X', name:"NOT_DEFINED"},

	],
	
    }
]
	
const maxSeverity = {
	"eq1": {
		0: 1,
		1: 4,
		2: 5
	},
	"eq2": {
		0: 1,
		1: 2
	},
	"eq3eq6": {
		0: { 0: 7, 1: 6 },
		1: { 0: 8, 1: 8 },
		2: { 1: 10 }
	},
	"eq4": {
		0: 6,
		1: 5,
		2: 4
	},
	"eq5": {
		0: 1,
		1: 1,
		2: 1
	},
}

const expectedMetricOrder = {
    // Base (11 metrics)
    "AV": ["N", "A", "L", "P"],
    "AC": ["L", "H"],
    "AT": ["N", "P"],
    "PR": ["N", "L", "H"],
    "UI": ["N", "P", "A"],
    "VC": ["H", "L", "N"],
    "VI": ["H", "L", "N"],
    "VA": ["H", "L", "N"],
    "SC": ["H", "L", "N"],
    "SI": ["H", "L", "N"],
    "SA": ["H", "L", "N"],
    // Threat (1 metric)
    "E": ["X", "A", "P", "U"],
    // Environmental (14 metrics)
    "CR":  ["X", "H", "M", "L"],
    "IR":  ["X", "H", "M", "L"],
    "AR":  ["X", "H", "M", "L"],
    "MAV": ["X", "N", "A", "L", "P"],
    "MAC": ["X", "L", "H"],
    "MAT": ["X", "N", "P"],
    "MPR": ["X", "N", "L", "H"],
    "MUI": ["X", "N", "P", "A"],
    "MVC": ["X", "H", "L", "N"],
    "MVI": ["X", "H", "L", "N"],
    "MVA": ["X", "H", "L", "N"],
    "MSC": ["X", "H", "L", "N"],
    "MSI": ["X", "S", "H", "L", "N"],
    "MSA": ["X", "S", "H", "L", "N"],
    // Supplemental (6 metrics)
    "S":  ["X", "N", "P"],
    "AU": ["X", "N", "Y"],
    "R":  ["X", "A", "U", "I"],
    "V":  ["X", "D", "C"],
    "RE": ["X", "L", "M", "H"],
    "U":  ["X", "Clear", "Green", "Amber", "Red"],
}

const SimpleCVSSv4App = forwardRef((props, ref) => {

    const [error, setError] = useState(null);
    const [selections, setSelections] = useState({AV:'N',AC:'L',AT:'N',PR:'N',UI:'N',VC:'N',VI:'N',VA:'N',SC:'N',SI:'N',SA:'N'});
    const [scoreVector, setScoreVector] = useState('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:N/SC:N/SI:N/SA:N');
    const [score, setScore] = useState(0);
    const [severity, setSeverity] = useState("");
    const [showDetail, setShowDetail] = useState(false);
    const [macro, setMacro] = useState(null);
    const [severityColor, setSeverityColor] = useState("success");
    const [calculate, setCalculate] = useState(true);
    const [cvss, setCVSS] = useState([]);
    const [existing, setExisting] = useState(false);
    const [userInput, setUserInput] = useState(false);
    const [vulIndex, setVulIndex] = useState(0);
    
    useEffect(() => {

	if (severity) {
            switch(severity.toUpperCase()) {
            case "HIGH":
            case "CRITICAL":
		setSeverityColor("danger");
		break;
            case "MEDIUM":
		setSeverityColor("warning");
		break;
            default:
		setSeverityColor("success");
            }
	}

    }, [severity]);


    useEffect(() => {

        if (userInput && props.userInput) {
	    
            props.userInput(true);
	}

    }, [userInput]);


    
    const CVSSPopover = React.forwardRef(
        ({ popper, children, show: _, ...props }, ref) => {
            const {name, label, options, tooltip} = props;

            useEffect(() => {
                popper.scheduleUpdate();
            }, [children, popper]);

            return (
                <Popover className="cvsspopover" ref={ref} body {...props}>
                    <Popover.Header as="h3">{name}</Popover.Header>
                    <Popover.Body>
                        <Row>
			    <p className="lead"><b>{tooltip}</b></p>
                            {Object.keys(options).map((o, index) => {
				return (
                                    <React.Fragment key={`${label}-${options[o].value}-${index}`}>
					<b>{o} ({label}:{options[o].value}):</b>
					<div dangerouslySetInnerHTML={{__html: options[o].tooltip}} />
                                    </React.Fragment>
				)
                            })}
                        </Row>
                    </Popover.Body>
                </Popover>
            )
        }
    )

    const selectOption = (key, e) => {
        const value = e;

	setUserInput(true);
        setCalculate(true);
        let newState = selections;
	newState[key] = value;
        setSelections(newState);

	createVector();

    }


    useImperativeHandle(ref, () => ({
	testSubmit,
	getScore,
	getVulIndex
    }));


    const getVulIndex = () => {
	return vulIndex;
    }
    
    const testSubmit = async (event, hide=true) => {
	if (event) {
            event.preventDefault();
	}

	if (!userInput) {
	    /* don't do anything */
	    return;
	}
	
	const formDataObj = {};

        formDataObj["vectorString"] = scoreVector;
	formDataObj["baseScore"] = parseFloat(score);
	formDataObj["baseSeverity"] = severity;
	formDataObj["version"] = "4.0";

        baseMatrices.forEach((item, index) => {
            let select = selections[item.key]

	    if (select && select != "X") {
		let name = item.options.find(x => x.key==select)
		if (name) {
                    formDataObj[item.nvd] = name.name;
		}
	    }
        });

        if (Object.keys(selections).length < 11) {
            setError("All fields are required.  Check all metrics and try again");
           return;
        }

	props.saveScore(formDataObj, hide);
	//props.hideModal();
  }
    
    const CVSSFormOption = (props) => {
	let values = [];

	Object.keys(props.options).forEach((option) => values.push(props.options[option].value))
	let default_value = "L";
	if (values.includes("X")) {
	    default_value = "X";
	} else if (values.includes("N")) {
	    default_value = "N";
	}
	const [localSelect, setLocalSelect] = useState(default_value);

	return (
            <>
                <Col lg={3} md={3} className="d-grid align-items-start">
                    <OverlayTrigger
                        trigger="click"
                        rootClose
                        placement="right"
                        overlay={<CVSSPopover
                                     name={props.name}
                                     label={props.label}
                                     options={props.options}
				     tooltip={props.tooltip}
                                 />}
                    >
                        <Button
			    size="sm"
                            variant="primary">
                            {props.name}
                        </Button>
                    </OverlayTrigger>
                </Col>
		<Col lg={9} md={12}>
		    <ToggleButtonGroup
			name={`${props.label}`}
			type="radio"
			value={props.selected[props.label] ? props.selected[props.label] : default_value}
			onChange={(e)=>(selectOption(props.label,e), setLocalSelect(e))}
		    >
                    {Object.keys(props.options).map((option, index) => {
                        const selected = props.selected[props.label] ? props.selected[props.label] : default_value;
                        return (
			    <ToggleButton
				id={`toggle-btn-${props.label}-${props.options[option].value}-${vulIndex}`}
                                key={`${props.label}-${option}-${vulIndex}`}
                                aria-label={option}
				size="sm"
				variant={selected == props.options[option].value ? "primary" : "outline-primary"}
                                value={props.options[option].value}
			    >
				{option}
			    </ToggleButton>
                        )
                    })
                    }
		    </ToggleButtonGroup>
                </Col>
            </>
        )

    }


    const createVector = () => {
	let vector = "CVSS:4.0";

	Object.keys(expectedMetricOrder).forEach((metric) => {
	    let v = selections[metric];

	    if (v && v != "X") {
		vector = vector.concat("/" + metric + ":" + v)
	    }
	});

	setScoreVector(vector);
	let vec = new CVSS40(vector);
	let score = vec.Score();
	setScore(score);
	let severity = CVSS40.Rating(score);
	setMacro(vec.macrovector());
	setSeverity(severity);
    }

    const getScore = () => {

	return scoreVector;

    }

    
    useEffect(() => {

	if (userInput) {
	    props.setCvss(scoreVector);
	}
	
    }, [scoreVector]);


    useEffect(() => {
	setError(null);
	setVulIndex(props.vulid);
	if (props.cvss) {
	    if (props.cvss.startsWith("CVSS:4.0")) {
		setUserInput(true);
		setExisting(true);
		setScoreVector(props.cvss)
		let vec = new CVSS40(props.cvss);
		let score = vec.Score();
		setScore(score);
		let severity = CVSS40.Rating(score);
		setMacro(vec.macrovector());
		setSeverity(severity);

		let newState = selections;
		    
		Object.keys(expectedMetricOrder).forEach((metric) => {
		    newState[metric] = vec.Get(metric);
		});
		setSelections(newState);		    
	    }
	} else {
	    createVector();
	    setUserInput(false);
	    setExisting(false);
	    //resetVector();
	}

    }, []);
    

    useEffect(() => {

	if (calculate) {
	    createVector();
	    setCalculate(false);
	}
	
    }, [calculate]);
    
    const resetVector = () => {
	setSelections({AV:'N',AC:'L',AT:'N',PR:'N',UI:'N',VC:'N',VI:'N',VA:'N',SC:'N',SI:'N',SA:'N'});
	setScore(0.0);
	setSeverity(null);
	setCalculate(true);

    }

    const removeScore = () => {	
	setUserInput(true);
	resetVector();
        props.saveScore(null, true);
        //props.hideModal();
    }

    const cancelScore = (e) => {
	e.preventDefault();
	props.hideModal();
    }

    
    const toggleShowDetail = () => {
	if (showDetail) {
	    setShowDetail(false);
	} else {
	    setShowDetail(true);
	}
    }

    return (
	<>
	    {error &&
	     <Alert variant="danger">{error}</Alert>
	    }


	    <div className="d-flex justify-content-between">
		<Form.Label>CVSS V4.0 Base Metrics</Form.Label>
		<Button variant="outline-secondary" size="sm" onClick={(e)=>(resetVector(), setUserInput(true))}>Reset</Button>
	    </div>
	    {userInput &&
	     <>
		 <p className="lead mb-1">{scoreVector}</p>
		 <p className="lead mb-1">CVSS v4.0 Score: <b>{score}</b>/ <Badge bg={severityColor}>{severity || `None`}</Badge> <Button variant="icon" onClick={(e)=>toggleShowDetail()}><i className={showDetail ? "fas fa-caret-square-up" : "fas fa-caret-square-down"}></i></Button></p>
		 {showDetail &&
		  <p>
		      <small>Macro vector: {macro}</small><br/>
		      {Object.keys(cvssMacroVectorDetails).map((k, idx) => (
			  <> {k}: <b>{cvssMacroVectorValues[macro[idx]]}</b><br/></>
		      ))}
		  </p>
		 }
	     </>
	    }

	    
	    {Object.keys(cvssConfig).slice(0, 1).map((met_type, idx) => (
		<React.Fragment key={`met-${vulIndex}-${idx}`}>
		    {Object.keys(cvssConfig[met_type]["metric_groups"]).map((group, index) => (
			<React.Fragment key={`${group}-${vulIndex}-${index}`}>
			    <Row className="pb-3">
				<Form.Text>{group}</Form.Text>
				
				{Object.keys(cvssConfig[met_type]["metric_groups"][group]).map((item, k) => {
				    return (
					<React.Fragment key={`${item}-${vulIndex}-${k}`}>
					    <Row className="pb-3">
						<CVSSFormOption
						    name= {item}
						    label = {cvssConfig[met_type]["metric_groups"][group][item].short}
						    tooltip = {cvssConfig[met_type]["metric_groups"][group][item].tooltip}
						    options = {cvssConfig[met_type]["metric_groups"][group][item].options}
						    selected={selections}
						/>
					    </Row>
					</React.Fragment>
				    )
				})}
				
				
				
			    </Row>
			</React.Fragment>
		    ))}
		</React.Fragment>
	    ))}
	    
	    
		{/*<div>
                <div className="d-flex justify-content-between">
                    {existing ?		     
                     <Button variant="danger" onClick={(e)=> (e.preventDefault(), removeScore())}>Remove Score</Button>
                     :
                     <div></div>
                    }
		    
		    <div>
			{error &&
			 <span className="error">There are errors above</span>
			}
			
		    </div>
		    <div className="d-flex justify-content-end gap-2">
                            <Button variant="secondary" onClick={(e) => cancelScore(e)}>
				Cancel
                            </Button>
			    <div>
				<Button variant="primary" type="submit" data-testid="real-submit">
				    Add Score
				</Button>
			    </div>
			</div>
			
			</div>*

                </div>
		
		</div>*/}
	</>
    )

})

export default SimpleCVSSv4App;
