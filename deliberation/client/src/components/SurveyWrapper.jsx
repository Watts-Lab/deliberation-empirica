import 'survey-react/modern.min.css';
import { Survey, StylesManager, Model } from 'survey-react';
import PropTypes from "prop-types";
import React from "react";

StylesManager.applyTheme("modern");

export default class SurveyWrapper extends React.PureComponent {

    render () {
        const {surveyJson} = this.props;
        const surveyModel = new Model(surveyJson);

        // TODO: empirica callbacks on survey completion
        return(
            <Survey model={surveyModel} />
        )
    }
}

SurveyWrapper.propTypes = {
    surveyJson: PropTypes.object.isRequired,
}