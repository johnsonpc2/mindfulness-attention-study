# Created: 2026/02/13
# Analysis of data from the Mindfulness and Attention Study, run Spring 2026.
#
# Shortcuts
#   alt + shift + k: shortcut guide
#   alt + o: collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t: run code section


# Setup -------------------------------------------------------------------

# First we need to install useful packages from GitHub
devtools::install_github(
  repo = "johnsonpc2/pcjtools",
  upgrade = "always",
  force = FALSE
)

devtools::install_github(
  repo = "bcdudek/bcdstats",
  upgrade = "never",
  force = FALSE
)

# And then we can actually load packages we'll use later
pcjtools::load_packages(c("bcdstats", "data.table", "gtsummary",
                          "pcjtools", "psych"))

# Not strictly necessary, but I clean the workspace before I do anything
clean_workspace(confirm = FALSE)

# Read In Data ------------------------------------------------------------

# Gather list of all data files in the "data" folder of the project directory
files_info(path = "./data", extension = ".csv") -> data_files

# Import the raw data from the files
import_data(x = data_files$filepath) -> raw_data

# Clean Data --------------------------------------------------------------

local({

  # Filter to just demographic trials; keep ID, phase, and response columns
  raw_data[
    phase %like% "demographics",
    list(sona_id, phase, response)
  ] -> demo_temp

  # Filter subjects
  demo_temp[!sona_id %in% c(
    78958, 79098, 78409, # multiple attempts
    79251, # no age; multiple attempts
    79283 # not English proficient
    )] -> demo_temp2

  # Widen the responses to wide format so each subject only has one line
  widen_responses(DT = demo_temp2) -> demo_temp3

  # Make age a numeric variable so we can calculate summary stats
  demo_temp3[, `:=`(age = as.numeric(age))] -> demo_temp3

  # Save the list of subjects IDs to keep
  demo_temp3[ , sona_id] -> demo_temp4

  # Gender Summary Table
  gtsummary::tbl_summary(
    data = demo_temp3,
    include = "gender"
  ) -> demo_temp5

  # Race Summary Table
  gtsummary::tbl_summary(
    data = demo_temp3,
    include = "race"
  ) -> demo_temp6

  # Age Summary Stats
  describe(x = demo_temp3$age, fast = TRUE) -> demo_temp7

  # Store all the demo info in a list so its in one place
  demo_data <- list(
    "demographics" = demo_temp3,
    "subjects to keep" = demo_temp4,
    "gender" = demo_temp5,
    "race" = demo_temp6,
    "age" = demo_temp7
  )

}) -> demo_data

# Visual Search Analysis --------------------------------------------------

raw_data[
  sona_id %in% demo_data$`subjects to keep` &
    phase == "visual_search_trial",
  list(sona_id, phase, rt, response, distractor_type, block, correct,
       target_present)
  ][, rt := as.numeric(rt)] -> vs_data


vs_data[, `:=`(prop_correct = mean(correct),
               avg_rt = mean(rt)),
        by = list(sona_id)] -> vs_data

# Survey Analysis ---------------------------------------------------------

local({

  raw_data[
    sona_id %in% demo_data$`subjects to keep` &
      phase %like% "survey",
    list(sona_id, phase, response)
  ] -> survey_temp

  widen_responses(DT = survey_temp, prefix = "phase") -> survey_temp2

  recode_cols(dt = survey_temp2, cols = 2:50, class = "numeric")

}) -> survey_data
