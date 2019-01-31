define(['questAPI'], function(Quest){

    let API = new Quest();
    let demo= 'true';

    let onFB = {
        type:'grid',
        name: 'iatevaluations',
        description: '<p>2. What do you think of the IAT?</p>',
        columns: ['Not at all', 'Slightly', 'Moderately', 'Very', 'Extremely'],
        rows:[
            'To what extent did you enjoy trying the IAT?',
            'To what extent did the IAT score you received change your view of yourself?',
            'To what extent are you skeptical of the IAT score that you received?'
        ],
        rowStemCss: {width:'280px'}
    };

    API.addSequence([
        {
            header: 'Debriefing',
            v1style:2, 
            questions:[
                {
                    type:'info',
                    name: 'iatresults',
                    description: '' +
						'<p>The sorting test you just took is called the Implicit Association Test (IAT). You categorized good and bad words with images of Old People and Young People.</p>' +
						'<div class="jumbotron jumbotron-dark">' +
						  '<h2>Here is your result:</h2>' +
						  '<p><%= global.ageiat.feedback %></p>' +
						'</div>' +

					    '<p>Your result is described as an "Automatic preference for Old People over Young People" if you were faster responding when <i>Old People</i> and <i>Good</i> are assigned to the same response key than when <i>Young People</i> and <i>Good</i> were classified with the same key. Your score is described as an "Automatic preference for Young People over Old People" if the opposite occurred.</p>' +
					    '<p>Your automatic preference may be described as "slight", "moderate", "strong", or "no preference". This indicates the <i>strength</i> of your automatic preference.</p>' +
						'<p>The IAT requires a certain number of correct responses in order to get results. If you made too many errors while completing the test you will get the feedback that there were too many errors to determine a result.</p>' + 
					    '<p><b>Note that your IAT result is based only on the categorization task and not on the questions that you answered.</b></p>'+
						'<hr>' +
					    '<h4>Please answer the following questions about your results:</h4>'
                },
                {
                    type:'dropdown',
                    name: 'broughtwebsite',
                    description:'<p>1. What brought you to this website?</p>',
                    answers: [
                        'Assignment for school',
                        'Assignment for work',
                        'Mention in a news story (any medium)',
                        'Mention or link at a non-news Internet site',
                        'My Internet search for this topic or a related topic',
                        'Recommendation of a friend or co-worker',
                        'Other'
                    ]
                },
                onFB,
                {
                    type:'info',
                    description:'<h4>Click "Submit" to submit your answers and receive more information.</h4></p>'
                }
            ]
        }
    ]);

    return API.script;
});

