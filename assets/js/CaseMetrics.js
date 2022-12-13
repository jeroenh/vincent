import React, { useState, useEffect, useMemo } from "react";
import {
    Row,
    CardGroup,
    Table,
    Button,
    Form,
    ToggleButton,
    ToggleButtonGroup,
    Alert,
    Card,
    Col,
} from "react-bootstrap";
import { useLocation, useNavigate, Link } from "react-router";
import DisplayLogo from "Components/DisplayLogo";
import ThreadAPI from "Components/ThreadAPI";
import DeleteConfirmation from "Components/DeleteConfirmation";
import ErrorModal from "Components/ErrorModal";
import ReportDatePicker from "Components/ReportDatePicker";
import StandardPagination from "Components/StandardPagination";
import DisplayState from "./DisplayState";
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Sector,
    Cell,
    Rectangle,
    LineChart,
    Tooltip,
    Line,
    CartesianGrid,
    XAxis,
    YAxis,
    BarChart,
    Bar,
    Legend,
} from "recharts";
import { format, formatDistance } from "date-fns";

const threadapi = new ThreadAPI();

import "Styles/casethread.css";

const COLORS = {
    primary: "#696cff",
    secondary: "#8592a3",
    success: "#71dd37",
    danger: "#ff3e1d",
    warning: "#ffab00",
    info: "#03c3ec",
    light: "#fcfdfd",
    dark: "#ff3e1d",
    unknown: "#e83e8c",
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
}) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
	    aria-label={name}
	    title={name}
            fill="white"
            textAnchor={x > cx ? "start" : "end"}
            dominantBaseline="central"
        >
            {name} {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const CaseMetrics = () => {
    const [currentRange, setCurrentRange] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [userLoading, setUserLoading] = useState(true);
    const [results, setResults] = useState([]);
    const [metadata, setMetadata] = useState({ teams: [] });
    const [decisions, setDecisions] = useState({});
    const [selectedTeam, setSelectedTeam] = useState("");
    const [userResults, setUserResults] = useState([]);
    const [userCaseResults, setUserCaseResults] = useState([]);
    const [status, setStatus] = useState("Active");
    const [selectedUser, setSelectedUser] = useState("");
    const [teamMetrics, setTeamMetrics] = useState({});
    const [totalTeamMetrics, setTotalTeamMetrics] = useState({});
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);

    const getAnalysisInsights = async (start_date, end_date) => {
        console.log(` here: ${start_date} ${end_date}`);
        await threadapi
            .getCaseMetrics(start_date, end_date)
            .then((response) => {
                console.log(response);
                setResults(response);
                if (response.scored_per_user.length > 0) {
                    setSelectedUser(response.scored_per_user[0].user.id);
                } else {
                    setSelectedUser("");
                }
                setIsLoading(false);
            })
            .catch((err) => {
                console.log(err);
                setError(`Error retrieving reports: ${err.message}`);
            });
    };

    const getUserData = async () => {
        console.log("GETUSER");
        await threadapi
            .getUserCaseMetrics(selectedUser)
            .then((response) => {
                setUserResults(response);
                setUserCaseResults(response.cases);
                setUserLoading(false);
                console.log(response);
            })
            .catch((err) => {
                setError(
                    `Error retrieving user assessment reports: ${err.message}`
                );
                console.log(err);
            });
    };

    const fetchInitialData = async (start_date, end_date) => {
        await threadapi
            .getCaseMetrics(start_date, end_date)
            .then((response) => {
                console.log(response);
                setMetadata(response);
                setSelectedTeam(response.teams[0].name);
                let tm = response.team_metrics.find(
                    (x) => x.team_name === response.teams[0].name
                );

                setTeamMetrics(tm);
                calculateTotalTeamMetrics(response.team_metrics);
		if (tm.cases_per_user.length > 0) {
                    setSelectedUser(tm.cases_per_user[0].uuid);
		}
                setIsLoading(false);
            })
            .catch((err) => {
                console.log(err);
            });
    };

    const generateReports = async (range) => {
        console.log(range[0]);
        const start_date = format(new Date(range[0].startDate), "yyyy-MM-dd");
        const end_date = format(new Date(range[0].endDate), "yyyy-MM-dd");
        setIsLoading(true);
        setCurrentRange({ start_date: start_date, end_date: end_date });

        //getSSVCInsights(start_date, end_date);
        //getAnalysisInsights(start_date, end_date);
    };

    useEffect(() => {
        if (selectedUser) {
            getUserData();
        } else {
	    setUserLoading(false);
	}
	    
    }, [selectedUser]);

    useEffect(() => {
        if (metadata?.team_metrics?.length > 0) {
            let tm = metadata.team_metrics.find(
                (x) => x.team_name === selectedTeam
            );
            setSelectedUser(tm.cases_per_user[0]?.uuid);
            setTeamMetrics(tm);
        }
    }, [selectedTeam]);

    useEffect(() => {
        if (currentRange) {
            fetchInitialData(currentRange.start_date, currentRange.end_date);
        }
    }, [currentRange]);

    const getCaseStates = (status) => {
        if (teamMetrics?.cases_by_status?.length > 0) {
            let s = teamMetrics.cases_by_status.find(
                (key) => key.status === status
            );
            if (s) {
                return s.count;
            }
            return 0;
        }
        return 0;
    };

    const filterUserCases = (event) => {
        if (event) {
            let filtered = userResults.cases.filter(
                (x) => x.state === event.name
            );
            setUserCaseResults(filtered);
        } else {
            setUserCaseResults(userResults.cases);
        }
    };

    const getStateColor = (state) => {
        if (metadata.states.length > 0) {
            let s = metadata.states.find((key) => key.name === state);
            console.log(s);
            if (s) {
                return COLORS[s.color];
            } else {
                return COLORS["unknown"];
            }
        }
    };

    const getColorByIndex = (index) => {
        const colorArray = Object.values(COLORS);
        return colorArray[index];
    };

    const calculateTotalTeamMetrics = (tm) => {
        let ttm = {
            cases_started: 0,
            cases_triaged: 0,
            vendors_notified: 0,
            cases_published: 0,
        };

        tm.forEach((team) => {
            ttm.cases_started += team.cases_started;
            ttm.cases_triaged += team.cases_triaged;
            ttm.vendors_notified += team.vendors_notified;
            ttm.cases_published += team.cases_published;
        });

        setTotalTeamMetrics(ttm);
    };

    return (
        <>
            <Row>
                <Col lg={9} sm={12}>
                    <h4 className="fw-bold py-3 mb-4">
                        <span className="text-muted fw-light">Cases /</span>{" "}
                        Metrics
                    </h4>
                </Col>
                <Col lg={3} sm={12} className="text-end mb-4"></Col>
            </Row>
            <Row>
                <Col lg={12}>
                    <Card className="mb-4">
                        <Card.Header>
                            {error && <Alert variant="danger">{error}</Alert>}
                            <div className="d-flex align-items-start gap-4">
                                <ReportDatePicker onChange={generateReports} />
                                <div className="d-flex align-items-center gap-2">
                                    <Form.Label htmlFor="team">
                                        Team:
                                    </Form.Label>
                                    <Form.Select
                                        title="select team"
                                        name="team"
                                        value={selectedTeam}
                                        onChange={(e) =>
                                            setSelectedTeam(e.target.value)
                                        }
                                    >
                                        {metadata &&
                                            metadata?.teams.map(
                                                (team, index) => {
                                                    return (
                                                        <option
                                                            key={`team-${index}`}
                                                            value={team.name}
                                                        >
                                                            {team.name}
                                                        </option>
                                                    );
                                                }
                                            )}
                                    </Form.Select>
                                </div>
                            </div>
                        </Card.Header>
                    </Card>
                </Col>
            </Row>
            {isLoading ? (
                <div className="text-center">
                    <div className="lds-spinner">
                        <div></div>
                        <div></div>
                        <div></div>
                    </div>
                </div>
            ) : (
                <>
                    <Row
                        xs={3}
                        md={3}
                        sm={3}
                        lg={3}
                        xl={3}
                        className="card-grid-wrapper"
                    >
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="goodtext metrics_icon fas fa-chart-line"></i>
                                    <Card.Title>Active Cases</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{getCaseStates("Active")}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="text-warning metrics_icon fas fa-calendar-plus"></i>
                                    <Card.Title>Pending Cases</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{getCaseStates("Pending")}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="far fa-window-close metrics_icon text-dark"></i>
                                    <Card.Title>Inactive Cases</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{getCaseStates("Inactive")}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>
                    {/*
                    <CardGroup>
                        <Card className="mb-4">
                            <Card.Header className="text-center">
                                <Card.Title>
                                    
                                </Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart
                                        width={600}
                                        height={300}
                                        data={[]}
                                    >
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                        />
                                        <XAxis dataKey="date" />
                                        <Line
                                            type="monotone"
                                            strokeWidth={2}
                                            name={"something"                                                
                                            }
                                            dataKey="scored"
                                            stroke="#8884d8"
                                        />
                                        <Line
                                            strokeWidth={2}
                                            type="monotone"
                                            name={
                                               "something"
                                            }
                                            dataKey="rescored"
                                            stroke="#82ca9d"
                                        />
                                        {reportType !== "SSVC" && (
                                            <Line
                                                strokeWidth={2}
                                                connectNulls={true}
                                                type="monotone"
                                                name="Published"
                                                dataKey="published"
                                                stroke="#E87C65"
                                            />
                                        )}
                                        <CartesianGrid stroke="#ccc" />
                                        <YAxis domain={[0, "dataMax+2"]} />
                                        <Tooltip filterNull={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>
                        <Card className="mb-4">
                            <Card.Header className="text-center">
                                <Card.Title>
                                    {reportType === "SSVC"
                                        ? `Assessed`
                                        : `Analyzed`}{" "}
                                    Per User
                                </Card.Title>
                                <small>
                                    Does not include{" "}
                                    {reportType === "SSVC"
                                        ? `re-assessed`
                                        : `re-analyzed`}{" "}
                                    vuls
                                </small>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart
                                        width={600}
                                        height={300}
                                        data={[]
                                            
                                        }
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="user.name" />
                                        <Bar
                                            dataKey="total_scored"
                                            fill="#8884d8"
                                            name={
                                                reportType === "SSVC"
                                                    ? "Total Scored"
                                                    : "Total Analyzed"
                                            }
                                            activeBar={
                                                <Rectangle
                                                    fill="pink"
                                                    stroke="blue"
                                                />
                                            }
                                        />
                                        <YAxis />
                                        <Tooltip />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>
                    </CardGroup>
                                        */}

                    <CardGroup>
                        <Card className="mb-4">
                            <Card.Header as="h5" className="text-center">
                                <Card.Title>
                                    {selectedTeam} Current Case State Breakdown
                                </Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer
                                    width="100%"
                                    height={500}
                                    aria-label="Team Metrics Pie chart"
                                >
                                    <PieChart width={600} height={600}>
                                        <Pie
                                            data={teamMetrics.cases_by_state}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={renderCustomizedLabel}
                                            outerRadius={"80%"}
                                            fill="#8884d8"
                                            dataKey="count"
                                            nameKey="state"
                                        >
                                            {teamMetrics.cases_by_state?.map(
                                                (entry, index) => (
                                                    <Cell
                                                        key={`cell-${index}`}
							title={entry.state}
                                                        fill={getStateColor(
                                                            entry.state
                                                        )}
                                                    />
                                                )
                                            )}
                                        </Pie>
                                        <Tooltip
                                            payload={metadata.cases_by_state}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>

                        <Card className="mb-4">
                            <Card.Header as="h5" className="text-center">
                                <Card.Title>
                                    {selectedTeam} Cases per User
                                </Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart
                                        width={600}
                                        height={300}
                                        data={teamMetrics.cases_per_user}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="user" />
                                        <Bar
                                            dataKey="count"
                                            fill="#8884d8"
                                            name="User Assigned Cases"
                                            activeBars={
                                                <Rectangle
                                                    fill="pink"
                                                    stroke="blue"
                                                />
                                            }
                                        />
                                        <YAxis />
                                        <Tooltip />
                                    </BarChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>
                    </CardGroup>
                    <Row
                        xs={2}
                        md={4}
                        sm={2}
                        lg={4}
                        xl={4}
                        className="card-grid-wrapper"
                    >
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="goodtext metrics_icon fas fa-plus"></i>
                                    <Card.Title>Cases Created</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{teamMetrics.cases_started}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="text-warning metrics_icon fas fa-notes-medical"></i>
                                    <Card.Title>Cases Triaged</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{teamMetrics.cases_triaged}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="text-primary metrics_icon fas fa-newspaper"></i>
                                    <Card.Title>Cases Published</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{teamMetrics.cases_published}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col>
                            <Card className="mb-4">
                                <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                    <i className="text-secondary far fa-paper-plane"></i>
                                    <Card.Title>Vendors Notified</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <h2>{teamMetrics.vendors_notified}</h2>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {/*<CardGroup>
                            <Card className="mb-4">
                                <Card.Header className="text-center">
                                    <Card.Title>ACT CVE's</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <Table>
                                        <thead>
                                            <tr>
                                                <th>CVE</th>
                                                <th>Assessed By</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {decisions?.results?.map(
                                                (item, index) => (
                                                    <tr
                                                        key={`cve-act-${index}`}
                                                    >
                                                        <td>
                                                            <a
                                                                href={`${item.url}`}
                                                            >
                                                                {item.cve}
                                                            </a>
                                                        </td>
                                                        <td>
                                                            {item.user.name}
                                                        </td>
                                                        <td>
                                                            {format(
                                                                new Date(
                                                                    item.scored_date
                                                                ),
                                                                "yyyy-MM-dd"
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </Table>
                                    <div className="inbox-pagination w-100">
                                        {decisions?.count > 0 && (
                                            <StandardPagination
                                                itemsCount={decisions?.count}
                                                itemsPerPage="10"
                                                currentPage={currentPage}
                                                setCurrentPage={setCurrentPage}
                                            />
                                        )}
                                    </div>
                                </Card.Body>
                            </Card>
                        </CardGroup>
                    ) : (
                        <CardGroup>
                            <Card className="mb-4">
                                <Card.Header>
                                    <Card.Title>Analysis Breakdown</Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <Table hover>
                                        <tbody>
                                            {results.details?.map(
                                                (item, idx) => (
                                                    <tr key={`detail-${idx}`}>
                                                        <td>{item.label}</td>
                                                        <td>{item.val}</td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                            <Card className="mb-4">
                                <Card.Header className="text-center">
                                    <Card.Title>
                                        Cumulative Vuls Added, Assessed, &
                                        Analyzed
                                    </Card.Title>
                                </Card.Header>
                                <Card.Body>
                                    <ResponsiveContainer
                                        width="100%"
                                        height={400}
                                    >
                                        <LineChart width={600} height={300}>
                                            <Legend
                                                verticalAlign="top"
                                                height={36}
                                            />
                                            <XAxis
                                                dataKey="date"
                                                xAxisId={"enrich"}
                                                allowDuplicatedCategory={false}
                                            />
                                            <Line
                                                type="monotone"
                                                connectNulls={true}
                                                strokeWidth={2}
                                                data={
                                                    ssvcResults.scored_per_day
                                                }
                                                name="Cumulative Assessed"
                                                xAxisId={"enrich"}
                                                dataKey="cumulative_scored"
                                                stroke="#8884d8"
                                            />
                                            <Line
                                                strokeWidth={2}
                                                connectNulls={true}
                                                type="monotone"
                                                name="Cumulative Analyzed"
                                                xAxisId={"enrich"}
                                                data={results.scored_per_day}
                                                dataKey="cumulative_published"
                                                stroke="#82ca9d"
                                            />
                                            <Line
                                                strokeWidth={2}
                                                connectNulls={true}
                                                xAxisId={"enrich"}
                                                data={results.scored_per_day}
                                                type="monotone"
                                                name="Cumulative Vuls Added"
                                                dataKey="cumulative_vuls"
                                                stroke="#E87C65"
                                            />
					    <Line
                                                strokeWidth={2}
                                                connectNulls={true}
                                                xAxisId={"enrich"}
                                                data={results.scored_per_day}
                                                type="monotone"
                                                name="Backlog"
                                                dataKey="backlog"
                                                stroke="#b434eb"
                                            />
                                            <CartesianGrid stroke="#ccc" />
                                            <YAxis domain={[0, "dataMax+2"]} />
                                            <Tooltip filterNull={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </Card.Body>
                            </Card>
                        </CardGroup>
                                            )} */}

                    <Card className="mb-4">
                        <Card.Header as="h5">
                            <Card.Title>Coordinator Cases</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Row>
                                {teamMetrics?.cases_per_user?.length > 0 ? (
                                    <Col lg={4}>
                                        <Form.Label>
                                            Select Coordinator
                                        </Form.Label>
                                        <Form.Select
                                            name="user"
					    title="Select User"
                                            value={selectedUser}
                                            onChange={(e) =>
                                                setSelectedUser(e.target.value)
                                            }
                                        >
                                            {teamMetrics.cases_per_user.map(
                                                (item, index) => {
                                                    return (
                                                        <option
                                                            key={`user-${index}`}
                                                            value={item.uuid}
                                                        >
                                                            {item.user}
                                                        </option>
                                                    );
                                                }
                                            )}
                                        </Form.Select>
                                    </Col>
                                ) : (
                                    <Col lg={6}>
                                        <Alert variant="info">
                                            No user information for the selected
                                            time period.
                                        </Alert>
                                    </Col>
                                )}
                            </Row>
                            {userLoading ? (
                                <div className="text-center">
                                    <div className="lds-spinner">
                                        <div></div>
                                        <div></div>
                                        <div></div>
                                    </div>
                                </div>
                            ) : (
                                <>
				    {userCaseResults.length >  0 &&
                                    <Row className="mt-3 mb-3">
                                        <Col lg={6}>
                                            <Card.Title className="text-center">
                                                Cases by State assigned to user
                                            </Card.Title>
                                            <ResponsiveContainer
                                                width="100%"
                                                height={500}
                                            >
                                                <PieChart
                                                    width={600}
                                                    height={600}
                                                >
                                                    <Pie
                                                        data={
                                                            userResults.cases_by_state
                                                        }
                                                        cx="50%"
                                                        cy="50%"
                                                        labelLine={false}
                                                        label={
                                                            renderCustomizedLabel
                                                        }
                                                        outerRadius={"80%"}
                                                        onClick={(e) =>
                                                            filterUserCases(e)
                                                        }
                                                        fill="#8884d8"
                                                        dataKey="count"
                                                        nameKey="state"
                                                    >
                                                        {userResults.cases_by_state?.map(
                                                            (entry, index) => (
                                                                <Cell
                                                                    key={`cell-${index}`}
								    title={entry.state}
                                                                    fill={getStateColor(
                                                                        entry.state
                                                                    )}
                                                                />
                                                            )
                                                        )}
                                                    </Pie>
                                                    <Tooltip
                                                        payload={
                                                            userResults.cases_by_state
                                                        }
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </Col>

                                        <Col lg={6}>
                                            <Card.Title className="d-flex justify-content-between align-items-center">
                                                Cases Assigned to User
                                                {userCaseResults.length !=
                                                    userResults?.cases?.length && (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={(e) =>
                                                            filterUserCases(
                                                                null
                                                            )
                                                        }
                                                    >
                                                        Show All
                                                    </Button>
                                                )}
                                            </Card.Title>
                                            <Table hover>
                                                <thead>
                                                    <tr>
                                                        <th>Case</th>
                                                        <th>Open</th>
                                                        <th>Modified</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {userCaseResults
                                                        .slice(
                                                            (currentPage - 1) *
                                                                10,
                                                            10 * currentPage
                                                        )
                                                        .map((item, idx) => (
                                                            <tr
                                                                key={`detail-${idx}`}
                                                            >
                                                                <td>
                                                                    {
                                                                        item.case_identifier
                                                                    }{" "}
                                                                    {item.title}{" "}
                                                                    <DisplayState
                                                                        state={
                                                                            item.state
                                                                        }
                                                                        states={
                                                                            metadata.states
                                                                        }
                                                                    />
                                                                </td>
                                                                <td>
                                                                    {formatDistance(
                                                                        new Date(
                                                                            item.created
                                                                        ),
                                                                        new Date(),
                                                                        {
                                                                            addSuffix: true,
                                                                        }
                                                                    )}
                                                                </td>
                                                                <td>
                                                                    {formatDistance(
                                                                        new Date(
                                                                            item.modified
                                                                        ),
                                                                        new Date(),
                                                                        {
                                                                            addSuffix: true,
                                                                        }
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </Table>
                                            {userCaseResults?.length > 10 && (
                                                <StandardPagination
                                                    itemsCount={
                                                        userCaseResults.length
                                                    }
                                                    itemsPerPage="10"
                                                    currentPage={currentPage}
                                                    setCurrentPage={
                                                        setCurrentPage
                                                    }
                                                />
                                            )}
                                        </Col>
                                    </Row>
				    }
                                </>
                            )}
                        </Card.Body>
                    </Card>
                    <Card className="mb-4">
                        <Card.Header as="h5">
                            <Card.Title>Cases By Tag</Card.Title>
                        </Card.Header>
                        <Card.Body>
                            <Row className="mt-3 mb-3">
                                <Col lg={6}>
                                    <Card.Title className="text-center">
                                    {selectedTeam} Tagged Cases
                                    </Card.Title>
                                    {teamMetrics.team_cases_by_tag.length > 0 ?
                                    <ResponsiveContainer
                                        width="100%"
                                        height={500}
                                    >
                                        <PieChart width={600} height={600}>
                                            <Pie
                                                data={
                                                    teamMetrics.team_cases_by_tag
                                                }
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={renderCustomizedLabel}
                                                outerRadius={"80%"}
                                                fill="#8884d8"
                                                dataKey="count"
                                                nameKey="tag"
                                            >
                                                {teamMetrics.team_cases_by_tag?.map(
                                                    (entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={getColorByIndex(
                                                                index
                                                            )}
                                                        />
                                                    )
                                                )}
                                            </Pie>
                                            <Tooltip
                                                payload={
                                                    metadata.team_cases_by_tag
                                                }
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    :
                                    <div className="text-center">No tagged cases.</div>
                                }
                                </Col>

                                <Col lg={6}>
                                    <Card.Title className="text-center">
                                        All Active Cases By Tag
                                    </Card.Title>
                                    {metadata.all_cases_by_tag.length > 0 ?
                                    <ResponsiveContainer
                                        width="100%"
                                        height={500}
                                    >
                                        <PieChart width={600} height={600}>
                                            <Pie
                                                data={
                                                metadata.all_cases_by_tag
                                                }
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={renderCustomizedLabel}
                                                outerRadius={"80%"}
                                                fill="#8884d8"
                                                dataKey="count"
                                                nameKey="tag"
                                            >
                                                {metadata.all_cases_by_tag?.map(
                                                    (entry, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={getColorByIndex(
                                                                index
                                                            )}
                                                        />
                                                    )
                                                )}
                                            </Pie>
                                            <Tooltip
                                                payload={
                                                    metadata.all_cases_by_tag
                                                }
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    :
                                    <div className="text-center">No active tagged cases.</div>
                                            }
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                    {metadata.lead && (
                        <>
                            <CardGroup>
                                <Card className="mb-4">
                                    <Card.Header as="h5" className="text-center">
                                        <Card.Title>
                                            VINCE-NT Case State Breakdown
                                        </Card.Title>
                                    </Card.Header>
                                    <Card.Body>
                                        <ResponsiveContainer
                                            width="100%"
                                            height={500}
                                        >
                                            <PieChart width={600} height={600}>
                                                <Pie
                                                    data={
                                                        teamMetrics.cases_by_state
                                                    }
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={
                                                        renderCustomizedLabel
                                                    }
                                                    outerRadius={"80%"}
                                                    fill="#8884d8"
                                                    dataKey="count"
                                                    nameKey="state"
                                                >
                                                    {teamMetrics.cases_by_state?.map(
                                                        (entry, index) => (
                                                            <Cell
                                                                key={`cell-${index}`}
                                                                fill={getStateColor(
                                                                    entry.state
                                                                )}
                                                            />
                                                        )
                                                    )}
                                                </Pie>
                                                <Tooltip
                                                    payload={
                                                        metadata.cases_by_state
                                                    }
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </Card.Body>
                                </Card>
                                <Card className="mb-4">
                                    <Card.Header as="h5" className="text-center">
                                        <Card.Title>Cases per Team</Card.Title>
                                    </Card.Header>
                                    <Card.Body>
                                        <ResponsiveContainer
                                            width="100%"
                                            height={400}
                                        >
                                            <BarChart
                                                width={600}
                                                height={300}
                                                data={metadata.cases_per_team}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="team" />
                                                <Bar
                                                    dataKey="count"
                                                    fill="#8884d8"
                                                    name="Assigned Cases"
                                                    activeBar={
                                                        <Rectangle
                                                            fill="pink"
                                                            stroke="blue"
                                                        />
                                                    }
                                                />
                                                <YAxis />
                                                <Tooltip />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </Card.Body>
                                </Card>
                            </CardGroup>

                            <Row
                                xs={2}
                                md={4}
                                sm={2}
                                lg={4}
                                xl={4}
                                className="card-grid-wrapper"
                            >
                                <Col>
                                    <Card className="mb-4">
                                        <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                            <i className="goodtext metrics_icon fas fa-plus"></i>
                                            <Card.Title>
                                                Total Cases Created
                                            </Card.Title>
                                        </Card.Header>
                                        <Card.Body>
                                            <h2>
                                                {totalTeamMetrics.cases_started}
                                            </h2>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="mb-4">
                                        <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                            <i className="text-warning metrics_icon fas fa-notes-medical"></i>
                                            <Card.Title>
                                                Total Cases Triaged
                                            </Card.Title>
                                        </Card.Header>
                                        <Card.Body>
                                            <h2>
                                                {totalTeamMetrics.cases_triaged}
                                            </h2>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="mb-4">
                                        <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                            <i className="text-primary metrics_icon fas fa-newspaper"></i>
                                            <Card.Title>
                                                Total Cases Published
                                            </Card.Title>
                                        </Card.Header>
                                        <Card.Body>
                                            <h2>
                                                {
                                                    totalTeamMetrics.cases_published
                                                }
                                            </h2>
                                        </Card.Body>
                                    </Card>
                                </Col>
                                <Col>
                                    <Card className="mb-4">
                                        <Card.Header as="h5" className="p-3 d-flex align-items-center gap-2">
                                            <i className="text-secondary far fa-paper-plane"></i>
                                            <Card.Title>
                                                Total Vendors Notified
                                            </Card.Title>
                                        </Card.Header>
                                        <Card.Body>
                                            <h2>
                                                {
                                                    totalTeamMetrics.vendors_notified
                                                }
                                            </h2>
                                        </Card.Body>
                                    </Card>
                                </Col>
                            </Row>
                        </>
                    )}

                    <CardGroup>
                        <Card className="mb-4">
                            <Card.Header as="h5" className="text-center">
                                <Card.Title>Users Created</Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart
                                        width={600}
                                        height={300}
                                        data={metadata.users_added_per_day}
                                    >
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                        />
                                        <XAxis dataKey="day" />
                                        <Line
                                            type="monotone"
                                            strokeWidth={2}
                                            name={"Users Added"}
                                            dataKey="count"
                                            stroke="#8884d8"
                                        />

                                        <CartesianGrid stroke="#ccc" />
                                        <YAxis domain={[0, "dataMax+2"]} />
                                        <Tooltip filterNull={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>
                        <Card className="mb-4">
                            <Card.Header as="h5" className="text-center">
                                <Card.Title>Groups Created</Card.Title>
                            </Card.Header>
                            <Card.Body>
                                <ResponsiveContainer width="100%" height={400}>
                                    <LineChart
                                        width={600}
                                        height={300}
                                        data={metadata.groups_added_per_day}
                                    >
                                        <Legend
                                            verticalAlign="top"
                                            height={36}
                                        />
                                        <XAxis dataKey="day" />
                                        <Line
                                            type="monotone"
                                            strokeWidth={2}
                                            name={"number of groups"}
                                            dataKey="count"
                                            stroke="#8884d8"
                                        />
                                        <CartesianGrid stroke="#ccc" />
                                        <YAxis domain={[0, "dataMax+2"]} />
                                        <Tooltip filterNull={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </Card.Body>
                        </Card>
                    </CardGroup>
                </>
            )}
        </>
    );
};

export default CaseMetrics;
