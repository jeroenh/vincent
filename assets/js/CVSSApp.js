import React from 'react'
import { useState, useEffect, forwardRef, useImperativeHandle} from 'react';
import { Badge, ToggleButton, ToggleButtonGroup, Modal, Popover, OverlayTrigger, Row, Col, ButtonGroup, Tab, Tabs, Alert, Form, Button } from "react-bootstrap";


const baseMatrices = [
    {
        key: 'AV',
        name: 'Attack Vector',
	nvd: 'attackVector',
        options: [
            {
                name: 'N',
                label: 'Network',
                tooltip: "<b>Worst:</b> The vulnerable component is bound to the network stack and the set of possible attackers extends beyond the other options listed below, up to and including the entire Internet. Such a vulnerability is often termed “remotely exploitable” and can be thought of as an attack being exploitable at the protocol level one or more network hops away (e.g., across one or more routers)."
            },
            {
                name: 'A',
                label: 'Adjacent_Network',
                tooltip: "<b>Worse:</b> The vulnerable component is bound to the network stack, but the attack is limited at the protocol level to a logically adjacent topology. This can mean an attack must be launched from the same shared physical (e.g., Bluetooth or IEEE 802.11) or logical (e.g., local IP subnet) network, or from within a secure or otherwise limited administrative domain (e.g., MPLS, secure VPN to an administrative network zone). One example of an Adjacent attack would be an ARP (IPv4) or neighbor discovery (IPv6) flood leading to a denial of service on the local LAN segment."
            },
            {
                name: 'L',
                label: 'Local',
                tooltip: "<b>Bad:</b> The vulnerable component is not bound to the network stack and the attacker’s path is via read/write/execute capabilities. Either: <ul><li>the attacker exploits the vulnerability by accessing the target system locally (e.g., keyboard, console), or remotely (e.g., SSH);</li><li>or the attacker relies on User Interaction by another person to perform actions required to exploit the vulnerability (e.g., using social engineering techniques to trick a legitimate user into opening a malicious document).</li></ul>"
            },
            {
                name: 'P',
                label: 'Physical',
                tooltip: "<b>Bad:</b> The attack requires the attacker to physically touch or manipulate the vulnerable component. Physical interaction may be brief (e.g., evil maid attack) or persistent. An example of such an attack is a cold boot attack in which an attacker gains access to disk encryption keys after physically accessing the target system. Other examples include peripheral attacks via FireWire/USB Direct Memory Access (DMA)."
            }],
    },
{
        key: 'AC',
    name: 'Attack Complexity',
    nvd: 'attackComplexity',
    options: [
            {
                name: 'L',
                label: 'Low',
                tooltip: "<b>Worst:</b> Specialized access conditions or extenuating circumstances do not exist. An attacker can expect repeatable success when attacking the vulnerable component.",
            },
            {
                name: 'H',
                label: 'High',
                tooltip: "<b>Bad:</b> A successful attack depends on conditions beyond the attacker's control. That is, a successful attack cannot be accomplished at will, but requires the attacker to invest in some measurable amount of effort in preparation or execution against the vulnerable component before a successful attack can be expected."
            }
        ]
},
     {
        key: 'PR',
         name: 'Privileges Required',
	 nvd: 'privilegesRequired',
        options: [{
            name: 'N',
            label: 'None',
            tooltip: "<b>Worst:</b> The attacker is unauthorized prior to attack, and therefore does not require any access to settings or files of the the vulnerable system to carry out an attack."
        }, {
            name: 'L',
            label: 'Low',
            tooltip: "<b>Worse</b> The attacker requires privileges that provide basic user capabilities that could normally affect only settings and files owned by a user. Alternatively, an attacker with Low privileges has the ability to access only non-sensitive resources."
        }, {
            name: 'H',
            label: 'High',
            tooltip: "<b>Bad:</b> The attacker requires privileges that provide significant (e.g., administrative) control over the vulnerable component allowing access to component-wide settings and files."
        }]
     },
    {
        key: 'UI',
        name: 'User Interaction',
	nvd: 'userInteraction',
        options: [
            {
                name: 'N',
                label: 'None',
                tooltip: "<b>Worst:</b> The vulnerable system can be exploited without interaction from any user."
            },
            {
                name: 'R',
                label: 'Required',
                tooltip: "<b>Bad:</b> Successful exploitation of this vulnerability requires a user to take some action before the vulnerability can be exploited. For example, a successful exploit may only be possible during the installation of an application by a system administrator."
            },
        ]
    },
    {
        key: 'S',
        name: 'Scope',
	nvd: 'scope',
        options: [
            {
                name: 'C',
                label: 'Changed',
                tooltip: "<b>Worst:</b> An exploited vulnerability can affect resources beyond the security scope managed by the security authority of the vulnerable component. In this case, the vulnerable component and the impacted component are different and managed by different security authorities."
            },
            {
                name: 'U',
                label: 'Unchanged',
                tooltip: "<b>Bad:</b> An exploited vulnerability can only affect resources managed by the same security authority. In this case, the vulnerable component and the impacted component are either the same, or both are managed by the same security authority."
            }]
    },

    {
        key: 'C',
        name: 'Confidentiality',
	nvd: 'confidentialityImpact',
        options: [{
            name: 'H',
            label: 'High',
            tooltip: "<b>Worst:</b> There is a total loss of confidentiality, resulting in all resources within the impacted component being divulged to the attacker. Alternatively, access to only some restricted information is obtained, but the disclosed information presents a direct, serious impact. For example, an attacker steals the administrator's password, or private encryption keys of a web server."
        }, {
            name: 'L',
            label: 'Low',
            tooltip: "<b>Bad:</b> There is some loss of confidentiality. Access to some restricted information is obtained, but the attacker does not have control over what information is obtained, or the amount or kind of loss is limited. The information disclosure does not cause a direct, serious loss to the impacted component."
        }, {
            name: 'N',
            label: 'None',
            tooltip: "<b>Good:</b> There is no loss of confidentiality within the impacted component."
        }


        ]
    },
     {
        key: 'I',
         name: 'Integrity',
	 nvd: 'integrityImpact',
        options: [{
            name: 'H',
            label: 'High',
            tooltip: "<b>Worst:</b> There is a total loss of integrity, or a complete loss of protection. For example, the attacker is able to modify any/all files protected by the impacted component. Alternatively, only some files can be modified, but malicious modification would present a direct, serious consequence to the impacted component."
        }, {
            name: 'L',
            label: 'Low',
            tooltip: "<b>Bad:</b> Modification of data is possible, but the attacker does not have control over the consequence of a modification, or the amount of modification is limited. The data modification does not have a direct, serious impact on the impacted component."
        }, {
            name: 'N',
            label: 'None',
            tooltip: "<b>Good:</b> There is no loss of integrity within the impacted component."
        }]
     },
    {
        key: 'A',
        name: 'Availability',
	nvd: 'availabilityImpact',
        options: [{
            name: 'H',
            label: 'High',
            tooltip: "<b>Worst:</b> There is a total loss of availability, resulting in the attacker being able to fully deny access to resources in the impacted component; this loss is either sustained (while the attacker continues to deliver the attack) or persistent (the condition persists even after the attack has completed). Alternatively, the attacker has the ability to deny some availability, but the loss of availability presents a direct, serious consequence to the impacted component (e.g., the attacker cannot disrupt existing connections, but can prevent new connections; the attacker can repeatedly exploit a vulnerability that, in each instance of a successful attack, leaks a only small amount of memory, but after repeated exploitation causes a service to become completely unavailable)."
        }, {
            name: 'L',
            label: 'Low',
            tooltip: "<b>Bad:</b> Performance is reduced or there are interruptions in resource availability. Even if repeated exploitation of the vulnerability is possible, the attacker does not have the ability to completely deny service to legitimate users. The resources in the impacted component are either partially available all of the time, or fully available only some of the time, but overall there is no direct, serious consequence to the impacted component."
        }, {
            name: 'N',
            label: 'None',
            tooltip: "<b>Good:</b> There is no impact to availability within the impacted component."
        }

        ]
    }
];

const weight = {
    AV:   { N: 0.85,  A: 0.62,  L: 0.55,  P: 0.2},
    AC:   { H: 0.44,  L: 0.77},
    PR:   { U:       {N: 0.85,  L: 0.62,  H: 0.27},         // These values are used if Scope is Unchanged
            C:       {N: 0.85,  L: 0.68,  H: 0.5}},         // These values are used if Scope is Changed
    UI:   { N: 0.85,  R: 0.62},
    S:    { U: 6.42,  C: 7.52},                             // Note: not defined as constants in specification
    C:    { N: 0,     L: 0.22,  H: 0.56},                   // C, I and A have the same weights
    I:    { N: 0,     L: 0.22,  H: 0.56},                   // C, I and A have the same weights
    A:    { N: 0,     L: 0.22,  H: 0.56},                   // C, I and A have the same weights
};


// Severity rating bands, as defined in the CVSS v3.1 specification.

const severityRatings  = [ { name: "None",     bottom: 0.0, top:  0.0},
                           { name: "Low",      bottom: 0.1, top:  3.9},
                           { name: "Medium",   bottom: 4.0, top:  6.9},
                           { name: "High",     bottom: 7.0, top:  8.9},
                           { name: "Critical", bottom: 9.0, top: 10.0} ];




const exploitabilityCoefficient = 8.22;
const scopeCoefficient = 1.08;

const CVSSApp = forwardRef((props, ref) => {

    const [error, setError] = useState(null);
    const [selections, setSelections] = useState({AV:'', AC: '', PR: '', UI: '', S: '', C: '', I: '', A: ''});
    const [fd, setFD] = useState({});
    const [scoreVector, setScoreVector] = useState('CVSS:3.1/AV:_/AC:_/PR:_/UI:_/S:_/C:_/I:_/A:_');
    const [score, setScore] = useState(0);
    const [severity, setSeverity] = useState("");
    const [severityColor, setSeverityColor] = useState("success");
    const [userInput, setUserInput] = useState(false);
    
    useEffect(() => {

        switch(severity) {
        case "High":
	case "Critical":
	case "high":
	case "critical":
            setSeverityColor("danger");
            break;
        case "Medium":
	case "medium":
            setSeverityColor("warning");
            break;
	default:
            setSeverityColor("success");
        }

    }, [severity]);


    function parseCVSSVector(vectorString) {

	let versionCheck = /^CVSS:(\d)\.(\d)\//.exec(vectorString);

	if (versionCheck != null) {
	    if (versionCheck[1] !== "3" || (['0', '1'].indexOf(versionCheck[2]) === -1)) {
		setError("CVSS Version != 3.0 or 3.1. Unable to parse existing vector");
	    }
	}
	const s = {};
	let segments = vectorString.split("/");
        for (let segment of segments) {

            // Split segment.
            let sections = segment.split(":");

            // Validate segment.
            if (sections.length != 2) {
                SetError("Invalid CVSS v3 vector segment: \"" + segment + "\"");
            }

	    let choice = sections[0].toUpperCase();

	    if (["AV", "AC", "PR", "UI", "S", "C", "I", "A"].includes(choice)) {
		s[choice] = sections[1];
	    }
	}
	setSelections(s);
	return s;

    }


    useEffect(() => {

	if (userInput) {
	    if (props.userInput) {
		props.userInput(true);
	    }
	}

    }, [userInput]);

    

    useEffect(() => {
	setUserInput(false);
	setError(null);
	if (props.metrics) {
	    if (props.metrics.version === "3.0") {
		setError("CVSSv3.0 is not supported.  Saving this score will convert the score to version 3.1");
		props.metrics.version = "3.1";
	    }
		
	    if (props.metrics.version === "3.1") {
		let s = {};
		Object.keys(props.metrics).map(key => {
		    if (props.metrics[key]) {
			switch(key) {
			case 'attackVector':
			case 'AV':
			    s['AV'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'attackComplexity':
			case 'AC':
			    s['AC'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'privilegesRequired':
			case 'PR':
			    s['PR'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'userInteraction':
			case 'UI':
			    s['UI'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'scope':
			case 'S':
			    s['S'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'confidentialityImpact':
			case 'C':
			    s['C'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'integrityImpact':
			case 'I':
			    s['I'] = props.metrics[key]?.slice(0,1);
			    break;
			case 'availabilityImpact':
			case 'A':
			    s['A'] = props.metrics[key]?.slice(0,1);
			    break;
			default:
				break;
			}
		    }
		})
		setSelections(s);
		
		if (Object.keys(s).length == 0) {
		    /*for some reason this doesn't have the selection breakdown :( */
		    /* must parse vector string */
		    if ('vectorString' in props.metrics) {
			parseCVSSVector(props.metrics['vectorString']);
		    } else if ('vector' in props.metrics) {
			s = parseCVSSVector(props.metrics['vector']);
		    }
		}
		if (Object.keys(s).length > 0) {
		    /* if vectorstring not there - parse selections and create one */
		    let vector = createVectorScore(s);
		    let cvss_score = calculateScore(s);
		    let cvss_severity = getSeverityRating(cvss_score);
		    
		    setScore(cvss_score);
		    setScoreVector(vector);
		    setSeverity(cvss_severity);
		} else {
		    if ('baseSeverity' in props.metrics) {
			setSeverity(props.metrics['baseSeverity'].toLowerCase());
		    }
		    if ('baseScore' in props.metrics) {
			setScore(props.metrics['baseScore']);
		    }
		    if ('vectorString' in props.metrics) {
			setScoreVector(props.metrics['vectorString']);
		    }
		}
	    }
	} else {
	    resetVector();
	}
	     

    }, [props.metrics])


    const selectOption = (key, e) => {

	const value = e;

	setUserInput(true);

	let newState = selections;
        newState[key] = value[0];
        setSelections(newState);

	let vector = createVectorScore(newState);
        let cvss_score = calculateScore(newState);
        let cvss_severity = getSeverityRating(cvss_score);

        setScore(cvss_score);
	setScoreVector(vector);
        setSeverity(cvss_severity);

    }


    const CVSSPopover = React.forwardRef(
	({ popper, children, show: _, ...props }, ref) => {
            const {name, label, options} = props;

            useEffect(() => {
                popper.scheduleUpdate();
            }, [children, popper]);

            return (
                <Popover className="cvsspopover" ref={ref} body {...props}>
                    <Popover.Header as="h3">{name}</Popover.Header>
                    <Popover.Body>
			<Row>
                        {options.map((o, index) => {
                            return (
                                <React.Fragment key={`${o.label}-${index}`}>
                                    <b>{o.label} ({label}:{o.name}):</b>
				    <div dangerouslySetInnerHTML={{__html: o.tooltip}} />
                                </React.Fragment>
                            )
			})}
			</Row>
                    </Popover.Body>
                </Popover>
            )
        }
    )


    const CVSSFormOption = (props) => {

	const [localSelect, setLocalSelect] = useState(props.selected[props.label] || null);

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
                                 />}
                    >
                        <Button
                            variant="primary">
                            {props.name}
                        </Button>
                    </OverlayTrigger>
                </Col>
		<Col lg={9} md={12}>
		    <ToggleButtonGroup
			name={`${props.nvd}`}
			type="radio"
			value={props.selected[props.label] || null}
			onChange={(e)=>(selectOption(props.label, e), setLocalSelect(e))}
			>
			{props.options.map((option, index) => {
			    const selected = props.selected[props.label] ? props.selected[props.label] : null;
                            return (
				<ToggleButton
				    id={`${props.label}-${option.label}`}
				    key={`${props.label}-${option.label}`}
				    aria-label={`${props.label}-${option.label}`}
				    variant={selected == option.name ? "primary" : "outline-primary"}
				    value = {option.label.toUpperCase()}
				>
                                    {option.label} ({props.label}:{option.name})
				</ToggleButton>
                            )
			})
			}
			</ToggleButtonGroup>
                </Col>
            </>
        )
    }


    /*<Form.Check
      type="radio"
      inline
      key={`${props.label}-${option.label}`}
      label={`${option.label} (${props.label}:${option.name})`}
      aria-label={option.label}
      name={`${props.nvd}`}
      value={option.label.toUpperCase()}
      defaultChecked = {selected === option.name}
      onChange={(e)=>(selectOption(props.label, option.name))}
      />*/


    const createVectorScore = (selected) => {
        let score = 'CVSS:3.1/AV:';
        score += selected['AV'] ? selected['AV'] : '_';
        score += "/AC:" + (selected['AC'] ? selected['AC'] : '_');
        score += "/PR:" + (selected['PR'] ? selected['PR'] : '_');
        score += "/UI:" + (selected['UI'] ? selected['UI'] : '_');
        score += "/S:" + (selected['S'] ? selected['S'] : '_');
        score += "/C:" + (selected['C'] ? selected['C'] : '_');
        score += "/I:" + (selected['I'] ? selected['I'] : '_');
        score += "/A:" + (selected['A'] ? selected['A'] : '_');
        return score;
    };



    const getSeverityRating = (score) => {
        let i;

        let severityRatingLength = severityRatings.length;
        for (i = 0; i < severityRatingLength; i++) {
            if (score >= severityRatings[i].bottom && score <= severityRatings[i].top) {
                return severityRatings[i].name;
            }
        }
        return {
            name: "?",
        };
    };



    const calculateScore = (selected) => {
        let metricWeight = {};
        Object.keys(weight).forEach((key) => {
            if (selected[key] && key === 'PR') {
                if (selected.S) {
                    metricWeight[key] = weight[key][selected.S][selected[key]];
                } else {
                    metricWeight[key] = 0;
                }
            } else if (selected[key]) {
                metricWeight[key] = weight[key][selected[key]];
            } else {
                metricWeight[key] = 0;
            }
        });
	let roundUpScore = function Roundup(input) {
            let int_input = Math.round(input * 100000);
            if (int_input % 10000 === 0) {
                return int_input / 100000
            } else {
                return (Math.floor(int_input / 10000) + 1) / 10
            }
        };

	try {
            let baseScore, impactSubScore;
            let impactSubScoreMultiplier = (1 - ((1 - metricWeight.C) * (1 - metricWeight.I) * (1 - metricWeight.A)));

            if (selected.S === 'U') {
                impactSubScore = metricWeight.S * impactSubScoreMultiplier;
            } else {
                impactSubScore = metricWeight.S * (impactSubScoreMultiplier - 0.029) - 3.25 * Math.pow(impactSubScoreMultiplier - 0.02, 15);
            }

            let exploitabilitySubScore = exploitabilityCoefficient * metricWeight.AV * metricWeight.AC * metricWeight.PR * metricWeight.UI;

            if (impactSubScore <= 0) {
                baseScore = 0;
            } else {
                if (selected.S === 'U') {
                    baseScore = roundUpScore(Math.min((exploitabilitySubScore + impactSubScore), 10));
                } else {
                    baseScore = roundUpScore(Math.min((exploitabilitySubScore + impactSubScore) * scopeCoefficient, 10));
                }
            }
            return baseScore.toFixed(1);
        } catch (err) {
            return err;
        }
    }

    /* useImperativeHandle is a React Hook that lets you customize the handle exposed as a ref. */
    /* this gets called when tabs change so score is saved between toggling cvss version tabs */
    
    useImperativeHandle(ref, () => ({
	testSubmit,
    }));
    
    const testSubmit = async (event, hide=true) => {

	const formDataObj = {};

	if (event) {
            event.preventDefault();
	}

	if (!userInput) {
	    /* no need to save if user hasn't modified anything */
	    return;
	}

	if (!severity) {
	    /* score reset - return null */
	    props.saveScore(null, hide);
	    return;
	}
	
	//const formData = new FormData(event.target),
         //     formDataObj = Object.fromEntries(formData.entries());

        // are all fields selected?

        let vector = createVectorScore(selections);
        let cvss_score = calculateScore(selections);
        let cvss_severity = getSeverityRating(cvss_score);

	setScore(cvss_score);
	setScoreVector(vector);
	setSeverity(cvss_severity);

        formDataObj["vectorString"] = vector;
        formDataObj["baseScore"] = parseFloat(cvss_score);
        formDataObj["baseSeverity"] = cvss_severity.toUpperCase();
	formDataObj["version"] = "3.1";
	//formDataObj["scenarios"] = [{"lang": "en", "value":"GENERAL"}];
	
	baseMatrices.forEach((item, index) => {
	    let select = selections[item.key]
	    let name = item.options.find(x => x.name==select)
	    if (name) {
		formDataObj[item.nvd] = name.label.toUpperCase();
	    } else {
		setError("All fields are required. Check all metrics and try again.");
	    }
	});
	    

	console.log(formDataObj);
        if (Object.keys(formDataObj).length != 12) {
            setError("All fields are required.  Check all metrics and try again");
           return;
        }

	props.saveScore(formDataObj, hide);
	
	//props.hideModal();

    }

    const removeScore = () => {
	setUserInput(true);
	setSelections({AV:'', AC: '', PR: '', UI: '', S: '', C: '', I: '', A: ''});
	setScore(0);
	setSeverity("");
	props.saveScore(null, true);
	//props.hideModal();
    }

    const resetVector = () => {
	setUserInput(true);
	setScoreVector('CVSS:3.1/AV:_/AC:_/PR:_/UI:_/S:_/C:_/I:_/A:_');
        setSelections({AV:'', AC: '', PR: '', UI: '', S: '', C: '', I: '', A: ''});
        setScore(0);
        setSeverity(null);
    }

    const cancelScore =	(e) => {
        e.preventDefault();
	props.hideModal();
    }
    

    return (
	<>
	    {error &&
	     <Alert variant="danger"> {error}</Alert>
	    }

	    <div className="d-flex justify-content-between">
                <h4>Common Vulnerability Scoring System 3.1 Calculator</h4>
                <Button variant="secondary" onClick={(e)=>resetVector()}>Reset</Button>
            </div>
            <p className="lead mb-0">{scoreVector}</p>
            <p className="lead mt-1">CVSS v3.1 Score: <b>{score}</b>/ <Badge bg={severityColor}>{severity || `None`}</Badge></p>


	    <Form onSubmit={(e)=>testSubmit(e)}>
		{baseMatrices.map((item, index) => (
		    <React.Fragment key={`${item.name}`}>
			<Row className="pb-3">
			    <CVSSFormOption
				name= {item.name}
				label = {item.key}
				nvd = {item.nvd}
				options = {item.options}
				selected={selections}
			    />
			</Row>
		    </React.Fragment>
		))}
		<div>
		    <div className="d-flex justify-content-between">
			{Object.keys(selections).length > 7 ?

			 <Button variant="danger" onClick={(e)=> (e.preventDefault(), removeScore())}>Remove Score</Button>
			 :
			 <div></div>
			}

			<div className="d-flex justify-content-end gap-2">
			    <Button variant="secondary" onClick={(e) => cancelScore(e)}>
                                Cancel
			    </Button>
			    <Button variant="primary" type="submit" data-testid="real-submit">
				Add Score
			    </Button>

                        </div>
		    </div>
                </div>
	    </Form>
	</>
    )
})


export default CVSSApp;
