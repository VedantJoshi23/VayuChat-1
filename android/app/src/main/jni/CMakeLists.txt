cmake_minimum_required(VERSION 3.13)
project(appmodules)
include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
# Link the Android logging library to the main app modules target
target_link_libraries(appmodules log)