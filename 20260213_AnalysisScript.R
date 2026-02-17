# Created: 2026/02/13
# Description: Analysis of data from the Mindfulness and Attention Study, run Spring 2026.
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
pcjtools::load_packages(c("bcdstats", "data.table", "ggplot2",
                          "gtsummary", "pcjtools", "psych"))

# Pull new data files from Pavlovia. BE CAREFUL, make sure this function pulls
# from the correct gitlab repository
pavlovia_pull()

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
  results <- list(
    "demographics" = demo_temp3,
    "subjects to keep" = demo_temp4,
    "gender" = demo_temp5,
    "race" = demo_temp6,
    "age" = demo_temp7
  )

}) -> demo_data

# Visual Search Analysis --------------------------------------------------

local({

  # Make a dataset of only the Visual Search data
  raw_data[sona_id %in% demo_data$`subjects to keep` &
             phase == "visual_search_trial",
           list(sona_id, phase, block, distractor_type, target_present,
                stimuli_list, rt, response, correct)
           ][, `:=`(rt = as.numeric(rt),
                    block = block + 1,
                    set_size = lengths(strsplit(gsub('\\[|\\]|"', '', stimuli_list), ",")))
             ][, stimuli_list := NULL] -> vs_data

  # Calculate the mean RT and p. correct for every condition for each subject
  # (Here we collapse across blocks)
  vs_data[, list(prop_correct = mean(correct),
                 avg_rt = mean(rt)),
          by = list(sona_id, distractor_type,
                    target_present, set_size)
          ] -> vs_collapsed

  # Calculate each subjects' p. accuracy > .80
  vs_collapsed[, list(total_conditions = .N,
                    n_low_accuracy = sum(prop_correct < 0.80),
                    prop_low_accuracy = mean(prop_correct < 0.80)),
             by = sona_id
             ] -> vs_accuracy

  results <- list(
    "vs_data" = vs_data,
    "vs_collapsed" = vs_collapsed,
    "vs_accuracy" = vs_accuracy
  )

}) -> vs_data

# Plot and save the accuracy and RT data for the visual search
local({

  ggplot(
    data = vs_data$vs_collapsed,
    mapping = aes(
      x = set_size,
      y = prop_correct,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.5)
    ) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 1)) +
    labs(
      title = "Accuracy High Across All Conditions:",
      subtitle = "No Set Size or Conjunction Effects",
      y = "pCorrect",
      x = "Set Size"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      palette = "ualbany",
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
    ) -> acc_plot

  ggplot(
    data = vs_data$vs_collapsed,
    mapping = aes(
      x = set_size,
      y = avg_rt,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.75),
      size = .75,
      linewidth = .75
    ) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 3175)) +
    labs(
      title = "Slow Decisions when Target Absent:",
      subtitle = "Set Size and Conjunction Effects",
      y = "Average RT (ms)",
      x = "Set Size"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      palette = "ualbany",
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
      ) -> rt_plot

  plot_results <- list(
    "vs_accuracy" = acc_plot,
    "vs_rt" = rt_plot
  )

}) -> vs_data$vs_plots


plot_saver(
  plots = vs_data$vs_plots,
  dir = "./plots",
  names = names(vs_data$vs_plots),
  dpi = 600,
  preview = FALSE,
  width = 15.3,
  height = 8.9
  )

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


# Backup to GitHub --------------------------------------------------------

git_push(push = TRUE)
