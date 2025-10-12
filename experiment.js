//// We will first define all the things we'll use, and then we will push them to the timeline so they will be executed when subjects start the experiment

// First, we need to initialize jsPsych to run with Pavlovia
const pavlovia_init = {
  type: jsPsychPavlovia,
  command: "init"
};

// And we will also need to close everything when we're done
const pavlovia_finish = {
  type: jsPsychPavlovia,
  command: "finish"
};

// This initializes jsPsych itself
const jsPsych = initJsPsych({
});

const image_files = [
  'images/Blue_Circle.png',
  'images/Blue_Triangle.png',
  'images/Red_Circle.png',
  'images/Red_Triangle.png',
  ];


const timeline = []; // Creates empty array to fill with procedure

// Visual search trials
var vs_instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<p>Press E if there is an elephant in the group.</p>
    <p>Press N if there is no elephant in the group.</p>`,
  choices: ['Continue']
}

var vs_trial = {
  type: jsPsychVisualSearchCircle,
  stimuli: [image_files[0], image_files[1], image_files[2], image_files[3]],
  fixation_image: '+',
  target_present_key: 'f',
  target_absent_key: 'j',
  target_present: true
}

var likert_scale = [
  "Almost Always", 
  "Very Frequently", 
  "Somewhat Frequently", 
  "Somewhat Infrequently", 
  "Very Infrequently",
  "Almost Never",
];

var mindfulness_survey = {
  type: jsPsychSurveyLikert,
  questions: [
    {prompt: "I could experiencing some emotion and not be concious of it until some time later. .", name: 'Emotion', labels: likert_scale},
    {prompt: "I break or spill things because of carelessness, not paying attention, or thinking of something else.", name: 'Carelessness', labels: likert_scale},
    {prompt: "I find it difficult to stay focused on whats happening in the present.", name: 'Focus', labels: likert_scale},
     {prompt: "I tend to walk quickly to get where I’m going without paying attention to what I experience along the way.", name: 'Walking', labels: likert_scale},
{prompt: "I tend not to notice feelings of physical tension or discomfort until they really grab my attention.", name: 'Feelings', labels: likert_scale},
  ],
  {prompt:"I forget a person’s name almost as soon as I’ve been told it for the first time.", name: 'Names', labels: likert_scale},
  ],
  {prompt:"It seems I am “running on automatic,” without much awareness of what I’m doing.", name: 'Automatic', labels: likert_scale},
  ],
   {prompt:"I rush through activities without being really attentive to them.", name: 'Rush', labels: likert_scale},
  ],
  {prompt:"I get so focused on the goal I want to achieve that I lose touch with what I’m doing right now to get there.", name: 'Now', labels: likert_scale},
   {prompt:"I do jobs or tasks automatically, without being aware of what I'm doing.", name: 'Tasks', labels: likert_scale},
   {prompt:"I find myself listening to someone with one ear, doing something else at the same time.", name: 'Multitasking', labels: likert_scale},
   {prompt:"I drive places on ‘automatic pilot’ and then wonder why I went there.", name: 'Driving', labels: likert_scale}
   {prompt:"I find myself preoccupied with the future or the past.", name: 'Preoccupied', labels: likert_scale},
   {prompt:"I find myself doing things without paying attention.", name: 'Attention', labels: likert_scale},
   {prompt:"I snack without being aware that I’m eating.", name: 'Eat', labels: likert_scale},

var likert_scale = [
  "Strongly Agree", 
  "Agree", 
  "Slightly Agree", 
  "Neither agree nor disagree", 
  "Slightly Disagree",
  "Disagree",
  "Strongly Disagree", 
];

var Satisfaction_Survery = {
  type: jsPsychSurveyLikert,
  questions: [
    {prompt: "In most ways my life is close to my ideal.", name: 'Ideal', labels: likert_scale},
    {prompt: "The conditions of my life are excellent.", name: 'Conditions', labels: likert_scale},
 {prompt: "I am satisfied with my life", name: 'Satified', labels: likert_scale},
 {prompt: "So far I have gotten the important things I want in life.", name: 'Important', labels: likert_scale},
{prompt: "If I could live my life over, I would change almost nothing.", name: 'Change', labels: likert_scale}, 

randomize_question_order: true
};

// Demographics survey: a block for entering age, gender, and race
var demographics_age = {
  type: jsPsychSurveyText,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Please enter your age in numerals (e.g., "24")</p>',
    name: 'age',
    required: false
  }],
  data: {
    phase: 'demographics_survey'
  },
  on_finish: function(data){
                data.response = JSON.stringify(data.response.age);
            }};

var demographics_gender = {
  type: jsPsychSurveyMultiSelect,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Which of the following gender identities best describes you? Please select all that apply.</p>',
    name: 'gender',
    options: [
      "Woman",
      "Man",
      "Transgender Woman",
      "Transgender Man",
      "Non-binary/gender non-conforming",
      "Other",
      "Prefer not to say"],
    required: false,
    vertical: true
  }],
  data: {
    phase: 'demographics_gender'
  }};

var demographics_gender_other = {
  type: jsPsychSurveyText,
  questions: [{
    prompt: '<p style=font-size:1.5vw>If you selected "Other", please specify. If you chose another option please answer "N/A"</p>',
    name: 'gender_other',
    required: false,
    vertical: true
  }],
  data: {
    phase: 'demographics_gender_other'
  }};

var demographics_race = {
  type: jsPsychSurveyMultiChoice,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Which of the following best describes you?</p>',
    name: 'race',
    options: [
      "Asian or Pacific Islander",
      "Black or African American",
      "Hispanic or Latino",
      "Indigenous or Native American",
      "White or Caucasian",
      "Multiracial"],
    required: false,
    vertical: true
  }],
  data: {
    phase: 'demographics_race'
  }};

//// Now that we've defined everything, we can start pushing things to the timeline that subjects will see

// First, we push the initialization to the timeline to kick everything off
timeline.push(pavlovia_init)

// Preload audio files from above to play later without lag
timeline.push({
  type: jsPsychPreload,
  audio: [image_files],
  data: {
    phase: 'image_preload'
  }
});

// Put the visual search trial here
timeline.push(vs_instructions);
timeline.push(vs_trial);

timeline.push(demographics_age);
timeline.push(demographics_gender);
timeline.push(demographics_gender_other);
timeline.push(demographics_race);

timeline.push(pavlovia_finish)

// Runs the timeline we created with all the code we've put on it
jsPsych.run(timeline);

console.log(timeline);
